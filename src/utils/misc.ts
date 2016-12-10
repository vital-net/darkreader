export function toArray<T>(obj: { [index: number]: T }): T[] {
    return (obj ? Array.prototype.slice.call(obj, 0) : []);
}

export function toCamelCase(spinalCase: string) {
    return spinalCase.split('-').map((p, i) => {
        if (i > 0) {
            p = p[0].toUpperCase() + p.substring(1);
        }
        return p;
    }).join('');
}