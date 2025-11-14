const ApiReference = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">API Reference</h1>
        <p className="text-xl text-muted-foreground">
          API documentation for integrating ProssMind into your applications.
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
        <p className="mb-4">
          ProssMind uses Supabase for authentication. API endpoints require authentication tokens.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Endpoints</h2>
        <p className="mb-4">
          API documentation is coming soon. For now, please use the web interface or contact support for API access.
        </p>
      </section>
    </div>
  );
};

export default ApiReference;




