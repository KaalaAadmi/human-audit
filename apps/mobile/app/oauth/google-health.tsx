import { Redirect } from 'expo-router';

// The OAuth return deep link (humanaudit://oauth/google-health?status=...) lands here if the router sees it too;
// WebBrowser.openAuthSessionAsync already consumed the status, so just go back to the list.
export default function GoogleHealthReturn() {
  return <Redirect href={'/data-sources' as any} />;
}
