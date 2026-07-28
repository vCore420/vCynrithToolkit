// Shared autosave helper, backed by IndexedDB rather than localStorage.
// localStorage caps out around 5MB per origin, which tileset images alone
// could blow through; IndexedDB has much more headroom and handles binary/
// data-URL strings without issue. Fails silently (no autosave, no crash) if
// IndexedDB isn't available in the browser.
const Autosave = (() => {
    const DB_NAME = 'vCynrithToolkitAutosave';
    const STORE = 'autosave';
    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    async function save(key, value) {
        try {
            const db = await openDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(value, key);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn(`Autosave: could not save "${key}"`, err);
        }
    }

    async function load(key) {
        try {
            const db = await openDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readonly');
                const req = tx.objectStore(STORE).get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn(`Autosave: could not load "${key}"`, err);
            return null;
        }
    }

    async function clear(key) {
        try {
            const db = await openDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).delete(key);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn(`Autosave: could not clear "${key}"`, err);
        }
    }

    // Collapses rapid-fire calls (e.g. one per brush stroke or per pixel
    // while painting) into a single save after things go quiet for `wait` ms,
    // so we're not hammering IndexedDB on every mouse-move.
    function debounce(fn, wait) {
        let t = null;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }

    // Turns an already-loaded HTMLImageElement into a data URL so it can be
    // stored and later restored without relying on blob: URLs, which don't
    // survive a page reload.
    function imageToDataUrl(img) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/png');
    }

    // Loads a data URL back into an HTMLImageElement, resolving once it's
    // actually decoded and ready to draw/measure.
    function dataUrlToImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    return { save, load, clear, debounce, imageToDataUrl, dataUrlToImage };
})();

window.Autosave = Autosave;
