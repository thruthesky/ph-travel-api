// 번호는 최소 3자리다. 1000번부터는 4자리 이상을 그대로 쓴다.
export const isPlaceFile = (name) => /^\d{3,}-.+\.json$/.test(name);
export const placeId = (name) => Number(name.match(/^(\d+)-/)?.[1]);
export const placeSlug = (name) => name.replace(/^\d+-/, '').replace(/\.json$/, '');
export const comparePlaceFiles = (a, b) => placeId(a) - placeId(b) || a.localeCompare(b);
