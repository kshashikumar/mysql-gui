import { storage } from './storage.utils';

describe('StorageUtils', () => {
    it('should store & retrieve item from local & session storage', () => {
        // LocalStorage
        storage.setItem('appTheme', 'dark');
        expect(storage.getItem('appTheme')).toBe('dark');

        // sessionStorage
        storage.setItem('appTheme', 'dark', { api: 'SessionStorage' });
        expect(storage.getItem('appTheme', { api: 'SessionStorage' })).toBe('dark');
    });

    it('should remove item from local & session storage', () => {
        // LocalStorage
        storage.setItem('appTheme', 'dark');
        expect(storage.getItem('appTheme')).toBe('dark');
        storage.removeItem('appTheme');
        expect(storage.getItem('appTheme')).toBeNull();

        // sessionStorage
        storage.setItem('appTheme', 'dark', { api: 'SessionStorage' });
        expect(storage.getItem('appTheme', { api: 'SessionStorage' })).toBe('dark');
        storage.removeItem('appTheme', { api: 'SessionStorage' });
        expect(storage.getItem('appTheme', { api: 'SessionStorage' })).toBeNull();
    });

    it('should clear all items from local & session storage', () => {
        // LocalStorage
        storage.clear();
        expect(localStorage.length).toBe(0);

        // sessionStorage
        storage.clear({ api: 'SessionStorage' });
        expect(localStorage.length).toBe(0);
    });
});
