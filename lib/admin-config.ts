/** Editor UI is off on public static deploy unless explicitly enabled. */
export const ADMIN_UI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADMIN !== 'false'
