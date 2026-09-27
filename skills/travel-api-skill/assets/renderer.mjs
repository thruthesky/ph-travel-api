// 여행 정보 API(v2) 블록 JSON 을 HTML 로 그리는 참고 렌더러. 외부 패키지 없음 — 브라우저·Node 모두에서 돈다.
//
//   import { catalogCss, renderPlace, renderPlaceCard, enhance } from './renderer.mjs';
//   const base = 'https://thruthesky.github.io/ph-travel-api/v2/';
//   const manifest = await (await fetch(base + 'manifest.json')).json();
//   const v = '?v=' + manifest.version;
//   const { places } = await (await fetch(base + manifest.places + v)).json();
//   const cdt = await (await fetch(base + manifest.content_display_type + v)).json();
//   document.head.insertAdjacentHTML('beforeend', FONT_LINKS + `<style>${catalogCss(cdt)}</style>`);
//   document.body.classList.add('cdt-root');   // 글자·배경색 (어두운 화면 포함)
//   root.innerHTML = renderPlace(places[0], { base, places });
//   enhance(root); // 탭 버튼을 누를 수 있게 한다
//
// 모양(CSS)은 content_display_type.json 의 css_variables·types[].css 를 그대로 쓴다. 클래스 접두어는 cdt-.
// 사진 저작자 표기(credit)는 모든 사진에 보인다. 전체가 링크인 카드 안에서는 <a> 를 겹칠 수 없어 글만 보이고,
// 원본 링크(source)는 상세 화면의 사진에서 준다.

/** 아이콘(Material Symbols)과 tagline 글꼴(Noto Serif KR). <head> 에 넣는다. */
export const FONT_LINKS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&family=Noto+Serif+KR:wght@500&display=swap">';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name) => (name ? `<span class="material-symbols-outlined" aria-hidden="true">${esc(name)}</span>` : '');
/** 링크·사진 주소는 http(s)·tel·mailto·상대 경로만 통과시킨다 — javascript: 같은 주소가 섞여도 실행되지 않게. */
const safe = (url) => (/^(https?:|tel:|mailto:|[./#?a-z0-9_-])/i.test(String(url ?? '')) && !/^\s*(javascript|data|vbscript):/i.test(String(url)) ? String(url) : '#');
const baseOf = (ctx) => { const b = ctx.base ?? ''; return b && !b.endsWith('/') ? `${b}/` : b; };
const abs = (ctx, url) => safe(/^https?:\/\//.test(url) ? url : `${baseOf(ctx)}${url}`);
const placeHref = (ctx, slug) => (ctx.placeHref ? ctx.placeHref(slug) : `#/place/${encodeURIComponent(slug)}`);
/** 같은 입력이면 같은 출력 — 아코디언 묶음 이름을 난수 대신 제목으로 만든다. */
const hash = (s) => { let h = 5381; for (const c of s) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h.toString(36); };
/** 사진 위 모서리에 얹는 저작자 표기. link=false 면 글만 (카드처럼 전체가 링크일 때). */
const creditBadge = (img, link = true) => `<small class="cdt-credit cdt-credit--overlay">${link ? `<a href="${esc(safe(img.source))}" target="_blank" rel="noopener">${esc(img.credit)}</a>` : esc(img.credit)}</small>`;

/** 표시 방법 목록의 CSS 를 하나로 모은다. <style> 에 넣어 쓴다. */
export function catalogCss(cdt) {
  const glue = '.cdt-root{color:var(--cdt-text);background:var(--cdt-surface)}.cdt-credit--overlay{position:absolute;right:8px;bottom:8px;max-width:calc(100% - 16px);margin:0;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.55);color:#fff;font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cdt-credit--overlay a{color:inherit}.cdt-card__media{position:relative;margin-bottom:12px}.material-symbols-outlined{font-size:1.15em;vertical-align:-.2em}.cdt-list[data-icon] .material-symbols-outlined{color:var(--cdt-accent);flex:none}.cdt-facts{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin:16px 0}.cdt-fact{padding:14px 16px;border:1px solid var(--cdt-border);border-radius:var(--cdt-radius)}.cdt-fact__label{display:flex;gap:6px;align-items:center;font-size:.8rem;color:var(--cdt-muted)}.cdt-fact__value{margin-top:4px;font-weight:600}.cdt-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:16px 0}';
  return `${cdt.css_variables}\n${Object.values(cdt.types).map((t) => t.css).join('\n')}\n${glue}`;
}

/** 글 조각 배열 — type 이 있는 조각만 cdt-<type> 으로 꾸민다. */
export function renderRuns(runs = [], ctx = {}) {
  return runs.map((r) => {
    let t = esc(r.text);
    if (r.bold) t = `<strong>${t}</strong>`;
    if (r.italic) t = `<em>${t}</em>`;
    if (r.underline) t = `<u>${t}</u>`;
    if (r.strike) t = `<s>${t}</s>`;
    const style = r.style ? ` style="${esc(Object.entries(r.style).map(([k, v]) => `${k}:${v}`).join(';'))}"` : '';
    switch (r.type) {
      case undefined: return style ? `<span${style}>${t}</span>` : t;
      case 'date': case 'time': return `<time class="cdt-${r.type}"${style}>${t}</time>`;
      case 'price': return `<data class="cdt-price"${r.min != null ? ` value="${esc(r.min)}"` : ''}${style}>${t}</data>`;
      case 'link': return `<a class="cdt-link" href="${esc(safe(r.url))}" target="_blank" rel="noopener"${style}>${t}</a>`;
      case 'place_link': return `<a class="cdt-place-link" href="${esc(placeHref(ctx, r.slug))}"${style}>${t}</a>`;
      case 'phone': return `<a class="cdt-phone" href="tel:${esc(r.tel ?? r.text)}"${style}>${t}</a>`;
      case 'address': return `<address class="cdt-address" style="display:inline">${t}</address>`;
      default: return `<span class="cdt-${esc(r.type)}"${style}>${t}</span>`;
    }
  }).join('');
}

function image(node, ctx, cls = 'cdt-image') {
  const size = node.width && node.height ? ` width="${node.width}" height="${node.height}"` : '';
  return `<figure class="${cls}"><img src="${esc(abs(ctx, node.url))}" alt="${esc(node.alt)}"${size} loading="lazy"><figcaption class="cdt-credit"><a href="${esc(safe(node.source))}" target="_blank" rel="noopener">${esc(node.credit)}</a></figcaption></figure>`;
}

const blocks = (list, ctx) => (list ?? []).map((b) => renderBlock(b, ctx)).join('');
const table = (cls, head, rows) => `<div class="cdt-table"><table class="${cls}"><thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

/** 블록 노드 하나. 모르는 type 은 content_display_type.json 의 rules 대로 대체해서 그린다. */
export function renderBlock(b, ctx = {}) {
  if (!b || typeof b !== 'object') return '';
  const label = b.label ? `<span class="cdt-label">${icon(b.icon)}${esc(b.label)}</span> ` : '';
  switch (b.type) {
    case 'section':
      return `<section id="${esc(b.key)}" class="cdt-section"><h2>${icon(b.icon)}${esc(b.title)}</h2>${blocks(b.blocks, ctx)}</section>`;
    case 'hero':
      return `<header class="cdt-hero"><img src="${esc(abs(ctx, b.image.url))}" alt="${esc(b.image.alt)}"><div class="cdt-hero__body"><h1>${esc(b.title)}</h1>${b.subtitle ? `<p class="cdt-hero__subtitle">${esc(b.subtitle)}</p>` : ''}${b.text ? `<p class="cdt-hero__text">${esc(b.text)}</p>` : ''}</div><small class="cdt-credit"><a href="${esc(safe(b.image.source))}" target="_blank" rel="noopener" style="color:inherit">${esc(b.image.credit)}</a></small></header>`;
    case 'tabs': {
      const id = `tab-${hash(b.items.map((it) => it.title).join('|'))}`;
      return `<div class="cdt-tabs">${b.items.length > 1 ? `<div role="tablist">${b.items.map((it, i) => `<button type="button" role="tab" id="${id}-t${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${icon(it.icon)}${esc(it.title)}</button>`).join('')}</div>` : `<h3 class="cdt-heading">${esc(b.items[0]?.title)}</h3>`}${b.items.map((it, i) => `<div role="tabpanel" id="${id}-p${i}"${b.items.length > 1 ? ` aria-labelledby="${id}-t${i}"` : ''}${i ? ' hidden' : ''}>${it.subtitle ? `<h3 class="cdt-heading">${esc(it.subtitle)}</h3>` : ''}${blocks(it.blocks, ctx)}</div>`).join('')}</div>`;
    }
    case 'accordion': {
      const group = `acc-${hash(b.items.map((it) => it.title).join('|'))}`;
      const anyOpen = b.items.some((it) => it.open);
      return `<div class="cdt-accordion">${b.items.map((it, i) => `<details name="${group}"${it.open || (!anyOpen && i === 0) ? ' open' : ''}><summary>${icon(it.icon)}${esc(it.title)}${it.subtitle ? ` <small>${esc(it.subtitle)}</small>` : ''}</summary>${blocks(it.blocks, ctx)}</details>`).join('')}</div>`;
    }
    case 'collapse':
      return `<details class="cdt-collapse"${b.open ? ' open' : ''}><summary>${esc(b.title)}</summary>${blocks(b.blocks, ctx)}</details>`;
    case 'grid': return `<div class="cdt-grid" style="--cols:${Number(b.columns) || 2}">${blocks(b.blocks, ctx)}</div>`;
    case 'masonry': return `<div class="cdt-masonry">${blocks(b.blocks, ctx)}</div>`;
    case 'carousel': return b.items?.length ? `<div class="cdt-carousel">${blocks(b.items, ctx)}</div>` : '';
    case 'card': {
      const target = b.place ? ctx.places?.find((p) => p.slug === b.place) : null;
      const img = b.image ?? target?.image;
      const linked = Boolean(b.place || b.url);
      const inner = `${img ? `<div class="cdt-card__media"><img src="${esc(abs(ctx, img.url))}" alt="" loading="lazy" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px">${creditBadge(img, !linked)}</div>` : ''}${b.number ? `<span class="cdt-card__number">${b.number}</span>` : ''}<h3>${esc(b.title)}</h3>${b.children ? `<p>${renderRuns(b.children, ctx)}</p>` : ''}`;
      if (b.place) return `<a class="cdt-card" href="${esc(placeHref(ctx, b.place))}" style="display:block;color:inherit;text-decoration:none">${inner}</a>`;
      if (b.url) return `<a class="cdt-card" href="${esc(safe(b.url))}" target="_blank" rel="noopener" style="display:block;color:inherit;text-decoration:none">${inner}</a>`;
      return `<article class="cdt-card">${inner}</article>`;
    }
    case 'stepper':
      return `<ol class="cdt-stepper">${b.items.map((it) => `<li>${it.time ? `<time>${esc(it.time)}</time>` : ''}${it.title ? `<strong>${esc(it.title)}</strong>` : ''}<p>${renderRuns(it.children, ctx)}</p></li>`).join('')}</ol>`;
    case 'hr': return '<hr class="cdt-hr">';
    case 'title': return `<h1 class="cdt-title">${esc(b.text)}</h1>`;
    case 'subtitle': return `<p class="cdt-subtitle"${b.lang ? ` lang="${esc(b.lang)}"` : ''}>${esc(b.text)}</p>`;
    case 'heading': { const n = Math.min(Math.max(Number(b.level) || 3, 2), 4); return `<h${n} class="cdt-heading">${esc(b.text)}</h${n}>`; }
    case 'typography': return `<p class="cdt-typography${b.variant ? ` cdt-typography--${esc(b.variant)}` : ''}">${esc(b.text)}</p>`;
    case 'paragraph': return `<p class="cdt-paragraph${b.variant ? ` cdt-paragraph--${esc(b.variant)}` : ''}">${renderRuns(b.children, ctx)}</p>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag} class="cdt-list"${b.icon ? ` data-icon="${esc(b.icon)}"` : ''}>${b.items.map((it) => `<li>${icon(b.icon)}<span>${renderRuns(it.children, ctx)}</span></li>`).join('')}</${tag}>`;
    }
    case 'blockquote': return `<blockquote class="cdt-blockquote"><p>${renderRuns(b.children, ctx)}</p>${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>`;
    case 'alert': return `<aside class="cdt-alert cdt-alert--${esc(b.variant ?? 'info')}" role="note">${icon(b.icon)}<div>${b.title ? `<strong>${esc(b.title)}</strong>` : ''}<p>${renderRuns(b.children, ctx)}</p></div></aside>`;
    case 'caption': return `<p class="cdt-caption"><small>${renderRuns(b.children, ctx)}</small></p>`;
    case 'badge': return `<span class="cdt-badge">${icon(b.icon)}${esc(b.text)}</span>`;
    case 'tags': return `<ul class="cdt-tags">${b.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    case 'image': return image(b, ctx);
    case 'figure': return `<figure class="cdt-figure">${image(b.image, ctx, 'cdt-image')}${b.children ? `<figcaption>${renderRuns(b.children, ctx)}</figcaption>` : ''}</figure>`;
    case 'avatar': return `<span class="cdt-avatar"><img src="${esc(abs(ctx, b.url))}" alt="${esc(b.alt)}">${esc(b.name ?? '')}</span>`;
    case 'video': return `<video class="cdt-video" src="${esc(abs(ctx, b.url))}"${b.poster ? ` poster="${esc(abs(ctx, b.poster))}"` : ''} controls preload="metadata" playsinline></video>`;
    case 'youtube': return `<iframe class="cdt-youtube" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.video_id)}${b.start ? `?start=${Number(b.start)}` : ''}" title="${esc(b.title ?? 'YouTube')}" loading="lazy" allowfullscreen></iframe>`;
    case 'audio': return `<audio class="cdt-audio" src="${esc(abs(ctx, b.url))}" controls preload="none"></audio>`;
    case 'music': return `<div class="cdt-music">${icon('music_note')}<div><strong>${esc(b.title)}</strong>${b.artist ? ` <small>${esc(b.artist)}</small>` : ''}</div><audio src="${esc(abs(ctx, b.url))}" controls preload="none"></audio></div>`;
    case 'map': return `<a class="cdt-map" href="https://www.google.com/maps/search/?api=1&amp;query=${b.latitude},${b.longitude}" target="_blank" rel="noopener" style="display:grid;place-items:center">${icon('map')} ${b.latitude}, ${b.longitude}</a>`;
    case 'table': return table('', b.columns, b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`));
    case 'pricing':
      return table('cdt-pricing', b.columns, b.items.map((it) => `<tr><th scope="row">${esc(it.label)}</th><td class="cdt-pricing__price">${esc(it.price)}</td><td class="cdt-pricing__note">${esc(it.note ?? '')}</td></tr>`));
    case 'chart': // 차트 라이브러리 없이 표로 대신 보여 준다. 실제 앱에서는 Chart.js 등으로 그린다.
      return table('', ['', ...b.labels], b.series.map((s) => `<tr><th scope="row">${esc(s.name)}</th>${s.values.map((v) => `<td>${esc(v)}${esc(b.unit ?? '')}</td>`).join('')}</tr>`));
    case 'rating': return `<span class="cdt-rating" role="img" aria-label="${esc(b.max)}점 만점에 ${esc(b.value)}점">${'★'.repeat(Math.round(b.value))}${'☆'.repeat(Math.max(0, Math.round(b.max) - Math.round(b.value)))} <b>${esc(b.value)}</b></span>`;
    case 'level': return `<span class="cdt-level"><meter min="0" max="${esc(b.max)}" value="${esc(b.value)}"></meter> ${esc(b.text)}</span>`;
    case 'latitude': return `${label}<data class="cdt-coord" value="${esc(b.value)}">${Math.abs(b.value)}° ${b.value >= 0 ? 'N' : 'S'}</data>`;
    case 'longitude': return `${label}<data class="cdt-coord" value="${esc(b.value)}">${Math.abs(b.value)}° ${b.value >= 0 ? 'E' : 'W'}</data>`;
    case 'date': case 'time': case 'duration': case 'price': case 'distance': case 'temperature':
    case 'address': case 'phone': case 'link': case 'place_link': case 'airport':
      return `${label}${renderRuns([{ ...b, label: undefined, icon: undefined }], ctx)}`;
    default:
      if (b.text !== undefined) return `<p>${esc(b.text)}</p>`;
      if (b.children) return `<p>${renderRuns(b.children, ctx)}</p>`;
      if (b.blocks) return blocks(b.blocks, ctx);
      return '';
  }
}

/** 정보 칸 하나 — label·icon 이 있는 값 노드를 "아이콘 이름표 / 값" 으로. */
function fact(node, ctx) {
  const value = node.type === 'level' ? renderBlock(node, ctx) : renderRuns([{ ...node, label: undefined, icon: undefined, text: node.text }], ctx);
  return `<div class="cdt-fact"><div class="cdt-fact__label">${icon(node.icon)}${esc(node.label)}</div><div class="cdt-fact__value">${value}</div></div>`;
}

/** 상세 화면 — content_display_type.json 의 layouts.place_detail 순서. 배지 줄에 추천도(rating)를 함께 둔다. */
export function renderPlace(p, ctx = {}) {
  const facts = ['location', 'best_season', 'duration', 'budget', 'difficulty', 'airport'].filter((k) => p[k]);
  return ['<article class="cdt-root cdt-place">',
    renderBlock({ type: 'hero', image: p.image, title: p.title.text, subtitle: p.title_en?.text, text: p.tagline?.text }, ctx),
    renderBlock(p.gallery, ctx),
    `<div class="cdt-meta">${['category', 'island_group', 'region'].filter((k) => p[k]).map((k) => renderBlock(p[k], ctx)).join('')}${p.rating ? renderBlock(p.rating, ctx) : ''}</div>`,
    p.tags ? renderBlock(p.tags, ctx) : '',
    p.summary ? renderBlock(p.summary, ctx) : '',
    `<div class="cdt-facts">${facts.map((k) => fact(p[k], ctx)).join('')}</div>`,
    p.latitude && p.longitude ? renderBlock({ type: 'map', latitude: p.latitude.value, longitude: p.longitude.value }, ctx) : '',
    ...(p.sections ?? []).map((s) => renderBlock(s, ctx)),
    '</article>',
  ].join('\n');
}

/** 목록 카드 — layouts.place_card 순서. 카드 전체가 링크라서 저작자 표기는 글만 사진 모서리에 얹는다. */
export function renderPlaceCard(p, ctx = {}) {
  const clamp = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';
  return `<a class="cdt-card" href="${esc(placeHref(ctx, p.slug))}" style="display:block;color:inherit;text-decoration:none;padding:0;overflow:hidden"><div class="cdt-card__media" style="margin:0"><img src="${esc(abs(ctx, p.image.url))}" alt="${esc(p.image.alt)}" loading="lazy" style="display:block;width:100%;aspect-ratio:16/10;object-fit:cover">${creditBadge(p.image, false)}</div><div style="padding:16px">${renderBlock(p.category, ctx)}<h3 style="margin:8px 0 4px">${esc(p.title.text)}</h3><p class="cdt-typography cdt-typography--tagline" style="font-size:1rem;margin:0 0 8px;${clamp}">${esc(p.tagline?.text)}</p><div class="cdt-meta" style="margin:0">${p.rating ? renderBlock(p.rating, ctx) : ''}${p.region ? renderBlock(p.region, ctx) : ''}</div></div></a>`;
}

/** 탭을 누를 수 있게 한다 — 브라우저에서 innerHTML 로 넣은 뒤 한 번 부른다. 좌우 방향키로도 옮겨 다닌다. */
export function enhance(root) {
  root.querySelectorAll('.cdt-tabs').forEach((tabs) => {
    const buttons = [...tabs.querySelectorAll(':scope > [role=tablist] > [role=tab]')];
    const panels = [...tabs.querySelectorAll(':scope > [role=tabpanel]')];
    const select = (i) => {
      buttons.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      panels.forEach((p, j) => { p.hidden = i !== j; });
    };
    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => select(i));
      btn.addEventListener('keydown', (e) => {
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        const j = (next + buttons.length) % buttons.length;
        select(j);
        buttons[j].focus();
      });
    });
  });
}
