import { signIn, signOut, signUpResident } from "../auth"
import { supabase } from "../supabase"

// Mock the supabase client
jest.mock("../supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn(),
        single: jest.fn(),
      }),
    }),
    channel: jest.fn((channelName) => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn().mockResolvedValue({ status: 'ok' }),
    })),
    removeAllChannels: jest.fn(),
  },
}))

describe("Auth Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("signIn", () => {
    it("should return success when sign in is successful", async () => {
      // Mock successful sign in
      const mockData = { user: { id: "123" } }
      ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: mockData,
        error: null,
      })

      const result = await signIn("test@example.com", "password")

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
      })
      expect(result).toEqual({ success: true, data: mockData })
    })

    it("should return error when sign in fails", async () => {
      // Mock failed sign in
      const mockError = { message: "Invalid credentials" }
      ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      })

      const result = await signIn("test@example.com", "wrong-password")

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "wrong-password",
      })
      expect(result).toEqual({ success: false, message: "Invalid credentials" })
    })
  })

  describe("signOut", () => {
    it("should return success when sign out is successful", async () => {
      // Mock successful sign out
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      })

      const result = await signOut()

      expect(supabase.auth.signOut).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it("should return error when sign out fails", async () => {
      // Mock failed sign out
      const mockError = { message: "Error signing out" }
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: mockError,
      })

      const result = await signOut()

      expect(supabase.auth.signOut).toHaveBeenCalled()
      expect(result).toEqual({ success: false, message: "Error signing out" })
    })
  })

  describe("signUpResident", () => {
    it("should return success when sign up is successful", async () => {
      // Mock successful sign up
      const mockUser = { id: "123" }
      ;(supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })
      ;(supabase.from("users").insert as jest.Mock).mockReturnValue({
        error: null,
      })

      const result = await signUpResident(
        "test@example.com",
        "password",
        "John",
        "Doe",
        "09123456789",
        "123 Main St",
        "ZONE 1",
        "secret phrase",
      )

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
        options: {
          data: {
            confirmation_phrase: "secret phrase",
            first_name: "John",
            last_name: "Doe",
            full_name: "John Doe",
            user_metadata: {
              confirmation_phrase: "secret phrase",
            },
          },
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        },
      })
      expect(supabase.from).toHaveBeenCalledWith("users")
      expect(result).toEqual({ success: true, message: "Please check your email for verification link." })
    })
  })
})
