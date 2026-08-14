"use client"

import Image from "next/image"

interface LogoProps {
    size?: number;
    className?: string;
    showText?: boolean;
    layout?: "horizontal" | "vertical";
}

export default function Logo({
    size = 100, // Base height
    className = "",
}: LogoProps) {
    const scaleFactor = 3.5;
    const calculatedHeight = size * scaleFactor;
    const calculatedWidth = calculatedHeight * 1.5;

    return (
        <div
            className={`flex items-center ${className}`}
            style={{
                display: "flex",
                alignItems: "center",
                width: "fit-content"
            }}
        >
            <Image
                src="/logo-combined-nobg.png"
                alt="EtherX DMail Logo"
                width={calculatedWidth}
                height={calculatedHeight}
                priority
                unoptimized={true}
                className="object-contain"
                style={{
                    display: "block",
                    filter: "brightness(1.2) contrast(1.1) drop-shadow(0 0 12px rgba(212, 175, 55, 0.6))",
                }}
            />
        </div>
    )
}
