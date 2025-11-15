// Complete, self-contained localStorage mock for Jest tests
export const localStorageMock = {
  store: {} as Record<string, string>,

  getItem: jest.fn((key: string) => localStorageMock.store[key] ?? null) as jest.Mock<string | null, [string]>,
  setItem: jest.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }) as jest.Mock<void, [string, string]>,
  removeItem: jest.fn((key: string) => {
    delete localStorageMock.store[key]
  }) as jest.Mock<void, [string]>,
  clear: jest.fn(() => {
    localStorageMock.store = {}
  }) as jest.Mock<void, []>,
}
