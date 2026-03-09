import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Verdict — GenLayer Party Game",
  description:
    "Two players. One absurd statement. The AI is judge. May the best argument win.",
  openGraph: {
    title: "The Verdict",
    description: "The AI-powered party debate game on GenLayer",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0d0a07" }}>
        {children}
      </body>
    </html>
  );
}
