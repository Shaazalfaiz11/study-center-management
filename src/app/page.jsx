import { redirect } from 'next/navigation';

export default function RootPage() {
  // Middleware has already decided whether there is a session; if we get
  // here at all, the user is signed in.
  redirect('/dashboard');
}
