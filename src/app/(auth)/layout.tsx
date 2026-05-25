const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
};
export default AuthLayout;
