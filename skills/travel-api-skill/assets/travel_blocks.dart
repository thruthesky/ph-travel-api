// 여행 정보 API(v2) 블록 JSON 을 Flutter 위젯으로 그리는 참고 구현.
//
// 의존성은 flutter/material.dart 하나다. 모델 클래스 없이 JSON(Map)을 그대로 그린다.
// 그래서 API 에 새 type·키가 늘어도 깨지지 않는다 — 모르는 type 은 content_display_type.json 의 rules 대로 대체한다.
//
//   const base = 'https://thruthesky.github.io/ph-travel-api/v2/';
//   final blocks = TravelBlocks(baseUrl: base, places: places, onPlaceTap: (slug) => context.push('/place/$slug'));
//   SingleChildScrollView(child: blocks.place(context, placeJson));
//
// 실제 앱에서 바꿔 끼울 곳: 사진 캐시(cached_network_image), 지도(flutter_map), 링크 열기(url_launcher), 차트(fl_chart).
import 'package:flutter/material.dart';

typedef Json = Map<String, dynamic>;

class TravelBlocks {
  const TravelBlocks({required this.baseUrl, this.places = const [], this.onPlaceTap, this.onLinkTap});

  /// places.json 이 있는 폴더 주소 — 사진 url 이 이 주소 기준 상대 경로다.
  final String baseUrl;

  /// 링크 카드(card.place)에 그 여행지의 사진을 보여 주려고 쓴다. 없어도 된다.
  final List<Json> places;
  final void Function(String slug)? onPlaceTap;
  final void Function(String url)? onLinkTap;

  String url(String u) => u.startsWith('http') ? u : '$baseUrl$u';

  // ───────────── 여행지 한 곳 — content_display_type.json 의 layouts.place_detail 순서 ─────────────

  Widget place(BuildContext context, Json p) {
    const factKeys = ['location', 'best_season', 'duration', 'budget', 'difficulty', 'airport'];
    final facts = [for (final k in factKeys) if (p[k] is Map) p[k] as Json];
    final gallery = p['gallery'] is Map ? p['gallery'] as Json : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _hero(context, p),
        if ((gallery?['items'] as List?)?.isNotEmpty ?? false) Padding(padding: const EdgeInsets.only(top: 8), child: block(context, gallery!)),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (final k in ['category', 'island_group', 'region']) if (p[k] is Map) block(context, p[k] as Json),
                  if (p['rating'] is Map) block(context, p['rating'] as Json),
                ],
              ),
              if (p['tags'] is Map) Padding(padding: const EdgeInsets.only(top: 12), child: block(context, p['tags'] as Json)),
              if (p['summary'] is Map) Padding(padding: const EdgeInsets.only(top: 12), child: block(context, p['summary'] as Json)),
              const SizedBox(height: 12),
              LayoutBuilder(builder: (context, c) {
                final w = c.maxWidth >= 600 ? (c.maxWidth - 24) / 3 : (c.maxWidth - 12) / 2;
                return Wrap(spacing: 12, runSpacing: 12, children: [for (final f in facts) SizedBox(width: w, child: _fact(context, f))]);
              }),
              if (p['latitude'] is Map && p['longitude'] is Map)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: block(context, {'type': 'map', 'latitude': p['latitude']['value'], 'longitude': p['longitude']['value']}),
                ),
              for (final s in (p['sections'] as List? ?? const [])) block(context, s as Json),
            ],
          ),
        ),
      ],
    );
  }

  Widget _hero(BuildContext context, Json p) {
    final image = p['image'] as Json;
    return SizedBox(
      height: 320,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _networkImage(image),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.center, colors: [Color(0xB8000000), Color(0x00000000)]),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(p['title']?['text'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
                if (p['title_en'] is Map) Text(p['title_en']['text'], style: const TextStyle(color: Colors.white70, fontSize: 16)),
                if (p['tagline'] is Map)
                  Padding(padding: const EdgeInsets.only(top: 8), child: Text(p['tagline']['text'], style: const TextStyle(color: Colors.white, fontSize: 18))),
              ],
            ),
          ),
          Positioned(top: 8, right: 8, child: _credit(image, onDark: true)),
        ],
      ),
    );
  }

  Widget _fact(BuildContext context, Json node) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: scheme.outlineVariant), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(iconData(node['icon']), size: 16, color: scheme.onSurfaceVariant),
            const SizedBox(width: 6),
            Flexible(child: Text(node['label'] ?? '', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant))),
          ]),
          const SizedBox(height: 4),
          node['type'] == 'level'
              ? block(context, node)
              : Text.rich(runs(context, [
                  {...node, 'label': null},
                ]), style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  // ───────────── 블록 노드 ─────────────

  Widget blocks(BuildContext context, List? list, {double gap = 12}) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, b) in (list ?? const []).indexed) ...[if (i > 0) SizedBox(height: gap), block(context, b as Json)],
        ],
      );

  Widget block(BuildContext context, Json b) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    switch (b['type']) {
      case 'section':
        return Padding(
          padding: const EdgeInsets.only(top: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                Icon(iconData(b['icon']), color: scheme.primary),
                const SizedBox(width: 8),
                Expanded(child: Text(b['title'] ?? '', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
              ]),
              Divider(color: scheme.primary, thickness: 2, height: 20),
              blocks(context, b['blocks']),
            ],
          ),
        );
      case 'hero':
        return _hero(context, {'image': b['image'], 'title': {'text': b['title']}, if (b['subtitle'] != null) 'title_en': {'text': b['subtitle']}, if (b['text'] != null) 'tagline': {'text': b['text']}});
      case 'tabs':
        return _Tabs(node: b, blocks: this);
      case 'accordion':
        final items = (b['items'] as List).cast<Json>();
        final anyOpen = items.any((it) => it['open'] == true);
        return Column(children: [
          for (final (i, it) in items.indexed)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ExpansionTile(
                leading: it['icon'] != null ? Icon(iconData(it['icon'])) : null,
                title: Text(it['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: it['subtitle'] != null ? Text(it['subtitle']) : null,
                initiallyExpanded: it['open'] == true || (!anyOpen && i == 0),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                children: [blocks(context, it['blocks'])],
              ),
            ),
        ]);
      case 'collapse':
        return ExpansionTile(
          title: Text(b['title'] ?? '', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600)),
          initiallyExpanded: b['open'] == true,
          children: [blocks(context, b['blocks'])],
        );
      case 'grid':
      case 'masonry':
        final children = (b['blocks'] as List? ?? const []).cast<Json>();
        return LayoutBuilder(builder: (context, c) {
          final cols = c.maxWidth >= 600 ? ((b['columns'] as int?) ?? 2) : 1;
          final w = (c.maxWidth - 12 * (cols - 1)) / cols;
          return Wrap(spacing: 12, runSpacing: 12, children: [for (final x in children) SizedBox(width: w, child: block(context, x))]);
        });
      case 'carousel':
        final items = (b['items'] as List? ?? const []).cast<Json>();
        return items.isEmpty ? const SizedBox.shrink() : _Carousel(items: items, blocks: this);
      case 'card':
        return _card(context, b);
      case 'stepper':
        return Column(children: [for (final it in (b['items'] as List).cast<Json>()) _step(context, it)]);
      case 'hr':
        return const Divider(height: 32);
      case 'title':
        return Text(b['text'] ?? '', style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800));
      case 'subtitle':
        return Text(b['text'] ?? '', style: text.titleMedium?.copyWith(color: scheme.onSurfaceVariant));
      case 'heading':
        return Text(b['text'] ?? '', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700));
      case 'typography':
        final style = switch (b['variant']) {
          'display' => text.displaySmall?.copyWith(fontWeight: FontWeight.w900),
          'overline' => text.labelSmall?.copyWith(letterSpacing: 1.5, color: scheme.primary, fontWeight: FontWeight.w700),
          _ => text.titleMedium?.copyWith(fontWeight: FontWeight.w500, height: 1.5),
        };
        return Text(b['text'] ?? '', style: style);
      case 'paragraph':
        final lead = b['variant'] == 'lead';
        return Text.rich(runs(context, b['children']), style: (lead ? text.bodyLarge : text.bodyMedium)?.copyWith(height: 1.75));
      case 'caption':
        return Text.rich(runs(context, b['children']), style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant));
      case 'list':
        final ordered = b['ordered'] == true;
        final items = (b['items'] as List).cast<Json>();
        return Column(children: [
          for (final (i, it) in items.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(
                  width: 28,
                  child: b['icon'] != null
                      ? Icon(iconData(b['icon']), size: 18, color: scheme.primary)
                      : Text(ordered ? '${i + 1}.' : '•', style: text.bodyMedium),
                ),
                Expanded(child: Text.rich(runs(context, it['children']), style: text.bodyMedium?.copyWith(height: 1.6))),
              ]),
            ),
        ]);
      case 'blockquote':
        return Container(
          padding: const EdgeInsets.only(left: 12),
          decoration: BoxDecoration(border: Border(left: BorderSide(color: scheme.outlineVariant, width: 4))),
          child: Text.rich(runs(context, b['children']), style: text.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
        );
      case 'alert':
        final color = switch (b['variant']) { 'success' => Colors.green, 'warning' => Colors.orange, 'danger' => Colors.red, _ => Colors.blue };
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border(left: BorderSide(color: color, width: 4)),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(iconData(b['icon'] ?? 'info'), color: color.shade800),
            const SizedBox(width: 10),
            Expanded(
              child: Text.rich(
                TextSpan(children: [
                  if (b['title'] != null) TextSpan(text: '${b['title']}\n', style: const TextStyle(fontWeight: FontWeight.w700)),
                  runs(context, b['children']),
                ]),
                style: text.bodyMedium?.copyWith(color: color.shade900, height: 1.5),
              ),
            ),
          ]),
        );
      case 'badge':
        return Chip(
          avatar: b['icon'] != null ? Icon(iconData(b['icon']), size: 16) : null,
          label: Text(b['text'] ?? ''),
          visualDensity: VisualDensity.compact,
        );
      case 'tags':
        return Wrap(spacing: 6, runSpacing: 6, children: [
          for (final t in (b['items'] as List)) Chip(label: Text('#$t'), visualDensity: VisualDensity.compact),
        ]);
      case 'image':
        return _image(b);
      case 'figure':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _image(b['image'] as Json),
          if (b['children'] != null) Text.rich(runs(context, b['children']), style: text.bodySmall),
        ]);
      case 'avatar':
        return Row(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(backgroundImage: NetworkImage(url(b['url'])), onBackgroundImageError: (error, stack) {}),
          const SizedBox(width: 8),
          Text(b['name'] ?? ''),
        ]);
      case 'video':
      case 'youtube':
      case 'audio':
      case 'music':
        // 재생은 video_player·youtube_player_iframe·just_audio 로 바꿔 끼운다.
        final icon = {'video': Icons.movie, 'youtube': Icons.smart_display, 'audio': Icons.graphic_eq, 'music': Icons.music_note}[b['type']];
        final link = b['type'] == 'youtube' ? 'https://youtu.be/${b['video_id']}' : url(b['url'] ?? '');
        return ListTile(leading: Icon(icon), title: Text(b['title'] ?? b['type']), subtitle: b['artist'] != null ? Text(b['artist']) : null, onTap: () => onLinkTap?.call(link));
      case 'map':
        // 실제 앱은 flutter_map(OpenStreetMap) 등으로 그리고, 누르면 geo:lat,lng 를 연다.
        return InkWell(
          onTap: () => onLinkTap?.call('https://www.google.com/maps/search/?api=1&query=${b['latitude']},${b['longitude']}'),
          child: Container(
            height: 180,
            decoration: BoxDecoration(color: scheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
            child: Center(child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.map), const SizedBox(width: 8), Text('${b['latitude']}, ${b['longitude']}')])),
          ),
        );
      case 'table':
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columns: [for (final c in (b['columns'] as List)) DataColumn(label: Text('$c'))],
            rows: [for (final r in (b['rows'] as List)) DataRow(cells: [for (final c in (r as List)) DataCell(Text('$c'))])],
          ),
        );
      case 'pricing':
        return _pricing(context, b);
      case 'chart':
        // 차트는 fl_chart 로 바꿔 끼운다. 여기서는 표로 대신 보여 준다.
        return block(context, {
          'type': 'table',
          'columns': ['', ...(b['labels'] as List)],
          'rows': [
            for (final s in (b['series'] as List)) [s['name'], ...(s['values'] as List).map((v) => '$v${b['unit'] ?? ''}')],
          ],
        });
      case 'rating':
        final value = (b['value'] as num).toDouble();
        final max = (b['max'] as num).round();
        return Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < max; i++)
            Icon(i < value.floor() ? Icons.star : (i < value ? Icons.star_half : Icons.star_border), size: 18, color: Colors.amber.shade700),
          const SizedBox(width: 4),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
        ]);
      case 'level':
        return Row(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < (b['max'] as int); i++)
            Container(
              width: 14,
              height: 6,
              margin: const EdgeInsets.only(right: 3),
              decoration: BoxDecoration(color: i < (b['value'] as int) ? scheme.primary : scheme.outlineVariant, borderRadius: BorderRadius.circular(3)),
            ),
          const SizedBox(width: 6),
          Text(b['text'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
        ]);
      case 'latitude':
      case 'longitude':
        final v = (b['value'] as num).toDouble();
        final dir = b['type'] == 'latitude' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
        return Text('${b['label'] != null ? '${b['label']} ' : ''}${v.abs()}° $dir');
      case 'date':
      case 'time':
      case 'duration':
      case 'price':
      case 'distance':
      case 'temperature':
      case 'address':
      case 'phone':
      case 'link':
      case 'place_link':
      case 'airport':
        return Text.rich(TextSpan(children: [
          if (b['label'] != null) TextSpan(text: '${b['label']}  ', style: TextStyle(color: scheme.onSurfaceVariant)),
          runs(context, [
            {...b, 'label': null},
          ]),
        ]));
      default:
        // 모르는 type — 앱이 멈추지 않게 대체해서 그린다.
        if (b['text'] is String) return Text(b['text']);
        if (b['children'] is List) return Text.rich(runs(context, b['children']));
        if (b['blocks'] is List) return blocks(context, b['blocks']);
        return const SizedBox.shrink();
    }
  }

  Widget _card(BuildContext context, Json b) {
    final scheme = Theme.of(context).colorScheme;
    final slug = b['place'] as String?;
    final target = slug == null ? null : places.where((p) => p['slug'] == slug).firstOrNull;
    final image = (b['image'] ?? target?['image']) as Json?;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: slug != null ? () => onPlaceTap?.call(slug) : (b['url'] != null ? () => onLinkTap?.call(b['url']) : null),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 저작자 표기는 사진 모서리에 한 줄로 — CC 라이선스 조건이라 링크 카드에서도 뺄 수 없다.
            if (image != null)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(fit: StackFit.expand, children: [
                  _networkImage(image),
                  Positioned(right: 6, bottom: 6, left: 6, child: Align(alignment: Alignment.bottomRight, child: _credit(image, onDark: true, maxLines: 1))),
                ]),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (b['number'] != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: CircleAvatar(
                      radius: 14,
                      backgroundColor: scheme.primary,
                      child: Text('${b['number']}', style: TextStyle(color: scheme.onPrimary, fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                  ),
                Text(b['title'] ?? '', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                if (b['children'] != null)
                  Padding(padding: const EdgeInsets.only(top: 6), child: Text.rich(runs(context, b['children']), style: const TextStyle(height: 1.6))),
              ]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _step(BuildContext context, Json it) {
    final scheme = Theme.of(context).colorScheme;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 24,
          child: Column(children: [
            Container(width: 12, height: 12, margin: const EdgeInsets.only(top: 4), decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle)),
            Expanded(child: Container(width: 2, color: scheme.outlineVariant)),
          ]),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (it['time'] != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(99)),
                  child: Text(it['time'], style: TextStyle(color: scheme.onPrimaryContainer, fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              if (it['title'] != null) Text(it['title'], style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text.rich(runs(context, it['children'])),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _pricing(BuildContext context, Json b) {
    final scheme = Theme.of(context).colorScheme;
    final items = (b['items'] as List).cast<Json>();
    return Column(children: [
      for (final it in items)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: scheme.outlineVariant))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(it['label'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
              const SizedBox(width: 12),
              Flexible(child: Text(it['price'] ?? '', textAlign: TextAlign.right, style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700))),
            ]),
            if (it['note'] != null) Text(it['note'], style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          ]),
        ),
    ]);
  }

  Widget _image(Json b) {
    final w = b['width'] as num?;
    final h = b['height'] as num?;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      AspectRatio(
        aspectRatio: w != null && h != null && h > 0 ? w / h : 3 / 2,
        child: ClipRRect(borderRadius: BorderRadius.circular(12), child: _networkImage(b)),
      ),
      const SizedBox(height: 4),
      _credit(b),
    ]);
  }

  Widget _networkImage(Json b) => Image.network(
        url(b['url'] ?? ''),
        fit: BoxFit.cover,
        semanticLabel: b['alt'],
        errorBuilder: (context, error, stack) => ColoredBox(color: Colors.black12, child: const Center(child: Icon(Icons.image_not_supported))),
      );

  /// 사진 저작자 표기 — CC 라이선스 조건이라 반드시 보여 준다. 누르면 원본 페이지(source)를 연다.
  Widget _credit(Json b, {bool onDark = false, int? maxLines}) => GestureDetector(
        onTap: b['source'] != null ? () => onLinkTap?.call(b['source']) : null,
        child: Container(
          padding: onDark ? const EdgeInsets.symmetric(horizontal: 6, vertical: 2) : EdgeInsets.zero,
          decoration: onDark ? BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(4)) : null,
          child: Text(
            b['credit'] ?? '',
            maxLines: maxLines,
            overflow: maxLines == null ? null : TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, height: 1.3, color: onDark ? Colors.white : Colors.black54),
          ),
        ),
      );

  // ───────────── 글 조각 ─────────────

  /// children 조각 배열을 TextSpan 하나로. type 이 있는 조각만 따로 꾸민다.
  TextSpan runs(BuildContext context, List? children) {
    final scheme = Theme.of(context).colorScheme;
    return TextSpan(children: [
      for (final r in (children ?? const []).cast<Json>()) _run(r, scheme),
    ]);
  }

  InlineSpan _run(Json r, ColorScheme scheme) {
    final text = r['text'] as String? ?? '';
    var style = switch (r['type']) {
      'price' => TextStyle(fontWeight: FontWeight.w700, color: scheme.primary),
      'date' => TextStyle(fontWeight: FontWeight.w600, color: scheme.primary),
      'time' => const TextStyle(fontWeight: FontWeight.w600, fontFeatures: [FontFeature.tabularFigures()]),
      'duration' => TextStyle(fontWeight: FontWeight.w600, backgroundColor: scheme.surfaceContainerHighest),
      'distance' => const TextStyle(fontWeight: FontWeight.w600),
      'temperature' => TextStyle(fontWeight: FontWeight.w600, color: Colors.deepOrange.shade700),
      _ => const TextStyle(),
    };
    if (r['bold'] == true) style = style.copyWith(fontWeight: FontWeight.w700);
    if (r['italic'] == true) style = style.copyWith(fontStyle: FontStyle.italic);
    if (r['underline'] == true) style = style.copyWith(decoration: TextDecoration.underline);
    if (r['strike'] == true) style = style.copyWith(decoration: TextDecoration.lineThrough);

    // 누를 수 있는 조각은 WidgetSpan 으로 — TextSpan 의 recognizer 는 dispose 를 챙겨야 해서 참고 구현에서는 피한다.
    final tap = switch (r['type']) {
      'place_link' => onPlaceTap == null ? null : () => onPlaceTap!(r['slug'] as String),
      'link' => onLinkTap == null ? null : () => onLinkTap!(r['url'] as String),
      'phone' => onLinkTap == null ? null : () => onLinkTap!('tel:${r['tel'] ?? text}'),
      _ => null,
    };
    if (tap != null) {
      return WidgetSpan(
        alignment: PlaceholderAlignment.baseline,
        baseline: TextBaseline.alphabetic,
        child: GestureDetector(
          onTap: tap,
          child: Text(text, style: style.copyWith(color: scheme.primary, decoration: TextDecoration.underline)),
        ),
      );
    }
    return TextSpan(text: text, style: style);
  }
}

// ───────────── 상태가 있는 블록 ─────────────

class _Tabs extends StatefulWidget {
  const _Tabs({required this.node, required this.blocks});
  final Json node;
  final TravelBlocks blocks;

  @override
  State<_Tabs> createState() => _TabsState();
}

class _TabsState extends State<_Tabs> {
  var index = 0;

  @override
  Widget build(BuildContext context) {
    final items = (widget.node['items'] as List).cast<Json>();
    final scheme = Theme.of(context).colorScheme;
    final item = items[index.clamp(0, items.length - 1)];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // 항목이 하나면 탭 막대 없이 제목만 보여 준다.
      if (items.length > 1)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final (i, it) in items.indexed)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(it['title'] ?? ''), selected: i == index, onSelected: (_) => setState(() => index = i)),
              ),
          ]),
        )
      else
        Text(item['title'] ?? '', style: TextStyle(fontWeight: FontWeight.w700, color: scheme.primary)),
      if (item['subtitle'] != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(item['subtitle'], style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        ),
      const SizedBox(height: 12),
      widget.blocks.blocks(context, item['blocks']),
    ]);
  }
}

class _Carousel extends StatefulWidget {
  const _Carousel({required this.items, required this.blocks});
  final List<Json> items;
  final TravelBlocks blocks;

  @override
  State<_Carousel> createState() => _CarouselState();
}

class _CarouselState extends State<_Carousel> {
  final controller = PageController(viewportFraction: 0.88);

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      // 첫 사진 비율로 높이를 잡는다. 비율이 다른 사진은 그 틀에 맞춰 자르고(cover), 저작자 표기는 한 줄로 줄인다.
      final first = widget.items.first;
      final ratio = (first['width'] is num && first['height'] is num) ? (first['width'] as num) / (first['height'] as num) : 3 / 2;
      final b = widget.blocks;
      return SizedBox(
        height: (c.maxWidth * 0.88 - 12) / ratio + 22,
        child: PageView(
          controller: controller,
          padEnds: false,
          children: [
            for (final it in widget.items)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: it['type'] == 'image'
                    ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(12), child: SizedBox.expand(child: b._networkImage(it)))),
                        const SizedBox(height: 4),
                        b._credit(it, maxLines: 1),
                      ])
                    : Center(child: b.block(context, it)),
              ),
          ],
        ),
      );
    });
  }
}

/// Material Symbols 이름 → Flutter 아이콘. 데이터의 icon 은 이 이름들을 쓴다. 모르는 이름은 점으로 대신한다.
IconData iconData(String? name) => _icons[name] ?? Icons.circle_outlined;

const _icons = <String, IconData>{
  'account_balance': Icons.account_balance,
  'airport_shuttle': Icons.airport_shuttle,
  'badge': Icons.badge,
  'beach_access': Icons.beach_access,
  'calendar_month': Icons.calendar_month,
  'check_circle': Icons.check_circle,
  'commute': Icons.commute,
  'directions': Icons.directions,
  'directions_boat': Icons.directions_boat,
  'directions_bus': Icons.directions_bus,
  'directions_car': Icons.directions_car,
  'directions_walk': Icons.directions_walk,
  'electric_rickshaw': Icons.electric_rickshaw,
  'error': Icons.error,
  'event_note': Icons.event_note,
  'explore': Icons.explore,
  'flight': Icons.flight,
  'hiking': Icons.hiking,
  'info': Icons.info,
  'landscape': Icons.landscape,
  'lightbulb': Icons.lightbulb,
  'local_taxi': Icons.local_taxi,
  'location_city': Icons.location_city,
  'location_on': Icons.location_on,
  'map': Icons.map,
  'music_note': Icons.music_note,
  'payments': Icons.payments,
  'restaurant': Icons.restaurant,
  'route': Icons.route,
  'schedule': Icons.schedule,
  'scuba_diving': Icons.scuba_diving,
  'signal_cellular_alt': Icons.signal_cellular_alt,
  'star': Icons.star,
  'tour': Icons.tour,
  'train': Icons.train,
  'warning': Icons.warning,
  'water': Icons.water,
  'wb_sunny': Icons.wb_sunny,
};
