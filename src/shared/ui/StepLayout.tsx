import { ReactNode } from "react";
import { Button } from "./Button";

interface StepLayoutProps {
  children: ReactNode;
  onComplete?: () => void;
  isCompleteDisabled?: boolean;
  completeLabel?: string;
  className?: string;
}

export const StepLayout = ({
  children,
  onComplete,
  isCompleteDisabled = false,
  completeLabel = "Продовжити",
  className = "",
}: StepLayoutProps) => {
  return (
    <div className={`space-y-4 my-auto w-full pb-4 ${className}`}>
      {children}

      {onComplete && (
        <Button
          onClick={onComplete}
          variant="primary"
          className="w-full mt-4"
          disabled={isCompleteDisabled}
        >
          {completeLabel}
        </Button>
      )}
    </div>
  );
};
