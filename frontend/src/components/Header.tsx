import { useBrandName } from "@/hooks/useBrandName";

const getLogoSrc = (): string => {
  const host = window.location.hostname;
  if (host.includes("demo.vilok.ai")) return "/vilok-logo.png";
  return "/vyom-logo.png";
};

export const Header = () => {
  const brandName = useBrandName();

  return (
    <header className="w-full border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg flex items-center gap-2">
              <img
                src={getLogoSrc()}
                alt={brandName}
                className="h-12 w-auto object-contain inline-block"
              />
            </span>
          </div>
          <p className="text-sm text-muted-foreground hidden sm:block">
            AI-Powered Voice & Chat Solutions
          </p>
        </div>
      </div>
    </header>
  );
};