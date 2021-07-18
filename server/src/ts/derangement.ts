/**
 * Generates a random derangement via algorithm described in [1]
 * 
 * ### References
 * [1] (Martínez et al., Generating Random Derangements 2008)
 * 
 * @param {number} lobby_size
 * @returns {number[]} Random derangement of given size
 */
export const randomDerangement = function (size: number): number[] {
    // initialize variables
    let indices: number[] = [];
    let marks: boolean[] = [];
    Array(size).forEach((v, i) => {
        indices.push(i);
        marks.push(false);
    })

    let i = size - 1;
    let u = size;
    while (u >= 2) {
        if (!marks[i]) {
            let j = 0;
            do {
                j = Math.floor(Math.random() * i);
            } while (!marks[j]);
            [indices[i], indices[j]] = [indices[j], indices[i]];
            let p = Math.random();
            if (p < (u - 1) * numDerangements(u - 2) / numDerangements(u)) {
                marks[j] = true;
            }
            u -= 1;
        }
        i -= 1;
    }
    return indices;
}

// quick memoize impl
const memoize_endomorphic = <T>(fn: (x: T) => T) => {
    let cache = new Map<T, T>();
    return (x: T) => {
        let cached = cache.get(x);
        return cached ? cached : fn(x);
    }
}

const fact_n = memoize_endomorphic<number>(
    (n) => {
        if (n === 0) {
            return 1;
        } else {
            return n * fact_n(n - 1);
        }
    }
);

const numDerangements = memoize_endomorphic<number>(
    (n) => {
        return Math.floor((fact_n(n) + 1) / Math.E);
    }
);