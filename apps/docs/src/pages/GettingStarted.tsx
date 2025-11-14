const GettingStarted = () => {
  const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:8081';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Getting Started</h1>
        <p className="text-xl text-muted-foreground">
          Welcome to ProssMind! This guide will help you get started with creating your first process diagrams.
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Sign Up</h2>
        <p className="mb-4">
          To get started, you'll need to create an account. Click the "Try It Free" button on the homepage or visit{" "}
          <a href={`${appUrl}/auth`} className="text-primary hover:underline">
            {appUrl}/auth
          </a>.
        </p>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Enter your email address</li>
          <li>Create a password (minimum 6 characters)</li>
          <li>Verify your email with the 6-digit code sent to your inbox</li>
          <li>You're ready to start creating diagrams!</li>
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Your First Diagram</h2>
        <p className="mb-4">
          Once you're logged in, you can create your first BPMN or P&ID diagram:
        </p>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Navigate to the Dashboard</li>
          <li>Click on "BPMN Generator" or "P&ID Generator"</li>
          <li>Describe your process in natural language</li>
          <li>Click "Generate" and wait for AI to create your diagram</li>
          <li>Edit and refine your diagram as needed</li>
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Explore the <a href="/guides" className="text-primary hover:underline">Guides</a> section for detailed instructions</li>
          <li>Check out the <a href="/tutorials" className="text-primary hover:underline">Tutorials</a> for step-by-step examples</li>
          <li>Read the <a href="/faq" className="text-primary hover:underline">FAQ</a> for common questions</li>
        </ul>
      </section>
    </div>
  );
};

export default GettingStarted;

