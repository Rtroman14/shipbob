import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
    variable: "--font-sans",
    subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
});

export const metadata = {
    title: "ShipBob Claims Assistant",
    description: "Evaluate damaged-in-transit shipping claims",
};

export default function RootLayout({ children }) {
    return (
        <html
            lang="en"
            className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col font-sans">
                {children}
                <Toaster />
            </body>
        </html>
    );
}
