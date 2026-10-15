-- Profiles are written only by the server (service role): name, password flag, onboarding, MCP last seen.
-- The old "update their own profile" policy let anyone signed in change every column of their row,
-- is_admin included, straight from the browser.
drop policy if exists "Users update their own profile" on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;
