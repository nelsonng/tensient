"use client";

import { motion } from "framer-motion";

interface SlantedButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "lg";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  href?: string;
}

export function SlantedButton({
  children,
  variant = "primary",
  size = "default",
  onClick,
  className = "",
  disabled = false,
  href,
}: SlantedButtonProps) {
  const baseClasses =
    "font-display font-bold text-sm uppercase tracking-wider cursor-pointer select-none inline-flex items-center justify-center";

  const sizeClasses = size === "lg" ? "h-20 px-10" : "h-16 px-8";

  const variantClasses = {
    primary: "bg-primary text-primary-foreground",
    outline: "bg-transparent text-primary border-2 border-primary",
    ghost: "bg-transparent text-primary hover:bg-primary/10",
  };

  const props = {
    className: `${baseClasses} ${sizeClasses} ${variantClasses[variant]} ${className}`,
    style: {
      clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
    },
    whileHover: { y: -2, filter: "brightness(1.1)" },
    whileTap: { y: 0, scale: 0.98 },
    transition: { duration: 0.15, ease: "easeOut" as const },
    onClick,
    disabled,
  };

  if (href) {
    return (
      <motion.a href={href} {...props}>
        {children}
      </motion.a>
    );
  }

  return <motion.button {...props}>{children}</motion.button>;
}
