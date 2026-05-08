export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-dojo-darker overflow-hidden">
      {children}
    </div>
  );
}
