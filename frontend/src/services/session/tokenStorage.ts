const accessTokenStorageKey = 'proplan.accessToken';

export function getAccessToken(): string | null {
  return window.localStorage.getItem(accessTokenStorageKey);
}

export function setAccessToken(accessToken: string): void {
  window.localStorage.setItem(accessTokenStorageKey, accessToken);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(accessTokenStorageKey);
}
