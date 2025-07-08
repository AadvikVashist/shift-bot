export default function WaitingApproval() {
  return (
    <main className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Account Pending Approval</h1>
        <p className="text-muted-foreground max-w-md">
          Your email isn’t linked to an active engineer profile yet. An administrator needs to approve your access. Please try again later or contact on-call.
        </p>
      </div>
    </main>
  );
} 