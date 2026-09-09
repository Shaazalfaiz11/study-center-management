import './globals.css';

export const metadata = {
  title: 'Self Study Center — Admin',
  description: 'Manage students, seats, memberships, billing and daily operations.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
