// travel.db(SQLite) 조회 — 앱에 넣은(임베딩) 여행 정보 DB 를 읽는 참고 구현. assets/TravelDb.php 와 같은 기능이다.
//
// 의존성: sqlite3 패키지(^3.0 — SQLite 3.5x 와 FTS5 를 함께 넣어 준다). Flutter 없이도 돈다 — 애셋 읽기는 함수로 받는다.
//
//   // pubspec.yaml: assets: [assets/travel.db, assets/travel.db.version]  ← travel-db.mjs build --out assets/travel.db
//   final dir = await getApplicationSupportDirectory();                      // path_provider
//   final travel = await TravelDb.openEmbedded(dir, (path) async => (await rootBundle.load(path)).buffer.asUint8List());
//   final lang = travel.lang('ko');
//   final page = travel.list(const TravelFilter(month: 12, category: 'beach'), lang, limit: 20);
//   final hits = travel.search('고래상어', lang);
//   final place = travel.place('boracay', lang);   // 블록 JSON (Map) — travel_blocks.dart 로 그린다
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:sqlite3/sqlite3.dart';

/// 목록 거르기 — 분류·권역·지역은 key(beach·visayas·cebu …)로 준다.
class TravelFilter {
  const TravelFilter({this.month, this.category, this.islandGroup, this.region, this.difficulty, this.tag, this.maxBudget, this.minRating, this.q, this.sort = 'id'});

  final int? month;
  final String? category;
  final String? islandGroup;
  final String? region;
  final int? difficulty;
  final String? tag;
  final int? maxBudget;
  final double? minRating;
  final String? q;

  /// id · rating(높은 순) · budget(싼 순) · name
  final String sort;
}

class TravelDb {
  TravelDb._(this.db, this.imageBase) {
    final version = db.select('PRAGMA user_version').first.columnAt(0) as int;
    if (version != 1) throw StateError('travel.db 스키마 버전 $version — 이 코드는 1 을 안다');
    meta = {for (final r in db.select("SELECT key, value FROM meta WHERE key != 'meta_json'")) r['key'] as String: r['value'] as String};
    // 표가 있어도 SQLite 가 trigram 을 모르면(3.34 미만) MATCH 가 예외를 낸다 — 한 번 찾아 보고, 안 되면 글에서 직접 찾는다
    var fts = db.select("SELECT 1 FROM sqlite_master WHERE name = 'place_fts'").isNotEmpty;
    if (fts) {
      try {
        db.select('''SELECT rowid FROM place_fts WHERE place_fts MATCH '"abc"' LIMIT 1''');
      } on SqliteException {
        fts = false;
      }
    }
    hasFts = fts;
  }

  final Database db;

  /// 사진 url 앞에 붙일 주소 — 앱에 사진을 넣었으면 그 경로, 아니면 API 주소
  final String imageBase;
  late final Map<String, String> meta;
  late final bool hasFts;

  /// DB 파일을 읽기 전용으로 연다.
  static TravelDb open(String path, {String? imageBase}) {
    final db = sqlite3.open(path, mode: OpenMode.readOnly);
    final base = imageBase ?? (db.select("SELECT value FROM meta WHERE key = 'base'").firstOrNull?['value'] as String? ?? '');
    return TravelDb._(db, base);
  }

  /// 앱에 넣은 DB 를 쓰기 가능한 폴더(dir)로 복사해 연다. 애셋은 바로 열 수 없어서 복사한다.
  /// 넣은 DB 의 버전(travel.db.version)이 바뀌었을 때만 다시 복사한다 — 임시 파일에 쓴 뒤 이름을 바꿔 통째로 교체.
  static Future<TravelDb> openEmbedded(Directory dir, Future<Uint8List> Function(String asset) readAsset,
      {String asset = 'assets/travel.db', String imageBase = 'https://thruthesky.github.io/ph-travel-api/v2/'}) async {
    final version = utf8.decode(await readAsset('$asset.version')).trim();
    final file = File('${dir.path}/travel.db');
    final mark = File('${dir.path}/travel.db.version');
    if (!await file.exists() || !await mark.exists() || (await mark.readAsString()).trim() != version) {
      await dir.create(recursive: true);
      final tmp = File('${file.path}.tmp');
      await tmp.writeAsBytes(await readAsset(asset), flush: true);
      await tmp.rename(file.path);
      await mark.writeAsString(version);
    }
    return open(file.path, imageBase: imageBase);
  }

  String get version => meta['version'] ?? '';

  List<Map<String, Object?>> languages() => db.select('SELECT code, name, dir, is_default FROM languages ORDER BY is_default DESC, code').map(Map.of).toList();

  /// 요청한 언어가 DB 에 있으면 그것을, 없으면 대체 언어(fallback).
  String lang(String? want) {
    final codes = languages().map((l) => l['code'] as String).toList();
    return codes.contains(want) ? want! : (meta['fallback_language'] ?? codes.first);
  }

  /// 글 방향 — ar 은 rtl. Directionality 에 쓴다.
  String dir(String lang) => db.select('SELECT dir FROM languages WHERE code = ?', [lang]).firstOrNull?['dir'] as String? ?? 'ltr';

  /// 거르기 메뉴 — kind: category · island_group · region · difficulty. {key, name, icon, count}
  List<Map<String, Object?>> terms(String kind, String lang) {
    final column = const {'category': 'category_key', 'island_group': 'island_group_key', 'region': 'region_key', 'difficulty': 'difficulty'}[kind];
    if (column == null) throw ArgumentError('모르는 kind — $kind');
    return db.select('''SELECT t.key, t.name, t.icon, (SELECT count(*) FROM places p WHERE CAST(p.$column AS TEXT) = t.key) AS count
      FROM terms t WHERE t.kind = ? AND t.lang = ? ORDER BY count DESC, t.key''', [kind, lang]).map(Map.of).toList();
  }

  /// 여행지 목록 — (전체 수, 이 쪽의 행들). 행은 place_list 뷰의 열과 같다.
  ({int total, List<Map<String, Object?>> items}) list(TravelFilter f, String lang, {int limit = 30, int offset = 0}) {
    final (sqlWhere, args) = _filterWhere(f, lang);
    // 정렬은 정해진 값만 — 입력을 SQL 에 그대로 넣지 않는다
    final order = const {'rating': 'rating DESC, id', 'budget': 'budget_min, id', 'name': 'title', 'id': 'id'}[f.sort] ?? 'id';
    final total = db.select('SELECT count(*) AS n FROM place_list WHERE $sqlWhere', args).first['n'] as int;
    final items = db.select('SELECT * FROM place_list WHERE $sqlWhere ORDER BY $order LIMIT ? OFFSET ?', [...args, limit, offset]).map(_withImage).toList();
    return (total: total, items: items);
  }

  /// list·search 의 거르기 → place_list 의 WHERE 와 인자.
  (String, List<Object?>) _filterWhere(TravelFilter f, String lang) {
    final where = <String>['lang = ?'];
    final args = <Object?>[lang];
    void add(String sql, List<Object?> values) {
      where.add(sql);
      args.addAll(values);
    }

    if (f.month != null) add('id IN (SELECT place_id FROM place_months WHERE month = ?)', [f.month]);
    if (f.category != null) add('category_key = ?', [f.category]);
    if (f.islandGroup != null) add('island_group_key = ?', [f.islandGroup]);
    if (f.region != null) add('region_key = ?', [f.region]);
    if (f.difficulty != null) add('difficulty = ?', [f.difficulty]);
    if (f.tag != null) add('id IN (SELECT place_id FROM place_tags WHERE lang = ? AND tag = ?)', [lang, f.tag]);
    if (f.maxBudget != null) add('budget_min <= ?', [f.maxBudget]);
    if (f.minRating != null) add('rating >= ?', [f.minRating]);
    if (f.q != null && f.q!.isNotEmpty) {
      final like = '%${f.q!.replaceAllMapped(RegExp(r'[\\%_]'), (m) => '\\${m[0]}')}%';
      add(r"(title LIKE ? ESCAPE '\' OR tagline LIKE ? ESCAPE '\' OR summary LIKE ? ESCAPE '\' OR tags LIKE ? ESCAPE '\')", [like, like, like, like]);
    }
    return (where.join(' AND '), args);
  }

  /// 검색어 → 낱말. "…" 로 감싼 곳은 한 구절("life vest"), 나머지는 공백과 문장부호(, ， 、 ; ； 。 ! ！ ? ？)로 나눈다.
  static List<String> words(String query) => RegExp(r'"([^"]+)"|[^\s,，、;；。!！?？"]+', unicode: true)
      .allMatches(query)
      .map((m) => (m.group(1) ?? m.group(0)!).trim())
      .where((w) => w.isNotEmpty)
      .toList();

  /// text 에 낱말이 모두 들어 있나 — 대소문자를 가리지 않는다(trigram 과 같게).
  static bool _hasAll(Object? text, List<String> words) {
    final low = '${text ?? ''}'.toLowerCase();
    return words.every((w) => low.contains(w.toLowerCase()));
  }

  /// 전문 검색 — 낱말(words())이 모두 들어 있는 여행지. 3글자(코드 포인트) 이상은 FTS5 trigram, 짧은 낱말은 글에서 직접.
  /// filter 는 list 와 같다 — 검색과 분류·달 거르기를 함께 쓴다(sort 는 무시).
  /// 순서: 제목에 모든 낱말 → 대표 태그에 모든 낱말 → 점수 → id (Node·PHP 구현과 같다).
  /// 행에 snippet 이 붙는다 — 찾은 낱말은 [ ] 로 감싸져 있다.
  List<Map<String, Object?>> search(String query, String lang, {int limit = 20, TravelFilter? filter}) {
    final words = TravelDb.words(query);
    if (words.isEmpty) return [];
    final long = words.where((w) => w.runes.length >= 3).toList();
    var short = words.where((w) => w.runes.length < 3).toList();
    final List<Map<String, Object?>> rows;
    if (long.isNotEmpty && hasFts) {
      final match = long.map((w) => '"${w.replaceAll('"', '""')}"').join(' AND ');
      rows = db.select('''SELECT t.place_id, t.title, t.tags, snippet(place_fts, 3, '[', ']', '…', 64) AS snippet, bm25(place_fts, 10, 6, 3, 1) AS score
        FROM place_fts JOIN place_texts t ON t.id = place_fts.rowid
        WHERE place_fts MATCH ? AND t.lang = ? ORDER BY score LIMIT 200''', [match, lang]).map(Map.of).toList();
    } else {
      rows = db.select('SELECT place_id, title, tags, NULL AS snippet, 0.0 AS score FROM place_texts WHERE lang = ?', [lang]).map(Map.of).toList();
      short = words; // FTS 가 없으면 모든 낱말을 글에서 찾는다 (점수·발췌는 첫 낱말 기준)
    }
    Set<int>? allowed;
    if (filter != null) {
      final (sqlWhere, args) = _filterWhere(filter, lang);
      allowed = {for (final r in db.select('SELECT id FROM place_list WHERE $sqlWhere', args)) r['id'] as int};
    }
    final hits = <Map<String, Object?>>[];
    for (final r in rows) {
      if (allowed != null && !allowed.contains(r['place_id'])) continue;
      if (short.isNotEmpty) {
        final t = db.select('SELECT title, tags, summary, body FROM place_texts WHERE place_id = ? AND lang = ?', [r['place_id'], lang]).first; // FTS 의 네 열과 같게
        final all = '${t['title']}\n${t['tags']}\n${t['summary']}\n${t['body']}';
        if (!_hasAll(all, short)) continue;
        if (r['snippet'] == null) {
          final w = short.first.toLowerCase();
          // 발췌는 요약·본문에서 먼저 — 제목·태그 나열로 시작하지 않게
          final body = '${t['summary']}\n${t['body']}';
          final text = _hasAll(body, [w]) ? body : all;
          final i = text.toLowerCase().indexOf(w);
          r['snippet'] = '${i > 30 ? '…' : ''}${text.substring(math.max(0, i - 30), i)}[${text.substring(i, i + w.length)}]${text.substring(i + w.length, math.min(text.length, i + w.length + 50))}…';
          r['score'] = -(all.toLowerCase().split(w).length - 1).toDouble(); // 많이 나올수록 앞으로
        }
      }
      r['snippet'] = (r['snippet'] as String).replaceAll('\n', ' ');
      // 이름으로 찾으면 그 여행지가, 대표 태그가 맞으면 그곳이 앞 — bm25 는 긴 본문에 불리하다
      r['boost'] = _hasAll(r['title'], words) ? 2 : (_hasAll(r['tags'], words) ? 1 : 0);
      hits.add(r);
    }
    // 제목 → 태그 → 점수 → id 순. Dart 의 sort 는 안정 정렬이 아니라서 마지막 기준까지 꼭 정한다
    hits.sort((a, b) {
      var c = (b['boost'] as int).compareTo(a['boost'] as int);
      if (c == 0) c = (a['score'] as num).compareTo(b['score'] as num);
      return c != 0 ? c : (a['place_id'] as int).compareTo(b['place_id'] as int);
    });
    final top = hits.take(limit).toList();
    final items = _rows(top.map((h) => h['place_id'] as int).toList(), lang);
    return [for (final h in top) {...items[h['place_id']]!, 'snippet': h['snippet']}];
  }

  /// 여행지 한 곳의 블록 JSON (그 언어). 사진 url 은 imageBase 를 붙인 절대 주소로 바꾼다. 없으면 null.
  Map<String, dynamic>? place(String slug, String lang) {
    final row = db.select('SELECT t.json FROM place_texts t JOIN places p ON p.id = t.place_id WHERE p.slug = ? AND t.lang = ?', [slug, lang]).firstOrNull;
    if (row == null) return null;
    dynamic fix(dynamic n) => switch (n) {
          Map() => {for (final e in n.entries) e.key as String: e.key == 'url' && e.value is String && (e.value as String).startsWith('images/') ? '$imageBase${e.value}' : fix(e.value)},
          List() => n.map(fix).toList(),
          _ => n,
        };
    return fix(jsonDecode(row['json'] as String)) as Map<String, dynamic>;
  }

  /// 직선거리로 가까운 여행지 — 행에 km 가 붙는다.
  List<Map<String, Object?>> near(String slug, String lang, {int limit = 5}) {
    final all = db.select('SELECT id, slug, latitude, longitude FROM places').toList();
    final from = all.firstWhere((p) => p['slug'] == slug, orElse: () => throw ArgumentError('없는 slug — $slug'));
    final km = <int, double>{
      for (final p in all)
        if (p['id'] != from['id']) p['id'] as int: _haversine(from['latitude'] as double, from['longitude'] as double, p['latitude'] as double, p['longitude'] as double),
    };
    final ids = (km.keys.toList()..sort((a, b) => km[a]!.compareTo(km[b]!))).take(limit).toList();
    final items = _rows(ids, lang);
    return [for (final id in ids) {...items[id]!, 'km': km[id]!.round()}];
  }

  void close() => db.close();

  Map<int, Map<String, Object?>> _rows(List<int> ids, String lang) {
    if (ids.isEmpty) return {};
    final rows = db.select('SELECT * FROM place_list WHERE lang = ? AND id IN (${List.filled(ids.length, '?').join(',')})', [lang, ...ids]);
    return {for (final r in rows) r['id'] as int: _withImage(r)};
  }

  /// 대표 사진 주소를 절대 주소로. 저작자(image_credit·image_source)는 화면에 반드시 보인다.
  Map<String, Object?> _withImage(Row r) {
    final m = Map<String, Object?>.of(r);
    final url = m['image_url'];
    if (url is String && url.startsWith('images/')) m['image_url'] = '$imageBase$url';
    return m;
  }

  static double _haversine(double lat1, double lng1, double lat2, double lng2) {
    const rad = math.pi / 180;
    final h = math.pow(math.sin((lat2 - lat1) * rad / 2), 2) + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.pow(math.sin((lng2 - lng1) * rad / 2), 2);
    return 2 * 6371 * math.asin(math.sqrt(h));
  }
}
