"use client";

type Strength = "empty" | "weak" | "medium" | "strong";

function getStrength(password: string): Strength {
  if (!password) return "empty";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isLongEnough = password.length >= 8;

  if (!isLongEnough) return "weak";
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (score <= 2) return "weak";
  if (score === 3) return "medium";
  return "strong";
}

const config: Record<Strength, { label: string; bars: number; color: string; textColor: string }> = {
  empty:  { label: "",       bars: 0, color: "bg-gray-200", textColor: "text-gray-400" },
  weak:   { label: "Weak",   bars: 1, color: "bg-red-400",  textColor: "text-red-500"  },
  medium: { label: "Medium", bars: 2, color: "bg-yellow-400", textColor: "text-yellow-600" },
  strong: { label: "Strong", bars: 3, color: "bg-green-500", textColor: "text-green-600" },
};

export default function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = getStrength(password);
  const { label, bars, color, textColor } = config[strength];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              bar <= bars ? color : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
    </div>
  );
}
