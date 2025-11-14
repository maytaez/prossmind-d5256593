const Tutorials = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Tutorials</h1>
        <p className="text-xl text-muted-foreground">
          Step-by-step tutorials to help you master ProssMind.
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Tutorial 1: Creating a Customer Onboarding Process</h2>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Navigate to BPMN Generator</li>
          <li>Enter: "Create a customer onboarding process with registration, email verification, profile setup, and welcome email"</li>
          <li>Click Generate</li>
          <li>Review the generated diagram</li>
          <li>Use the refine feature to add additional steps if needed</li>
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Tutorial 2: Uploading and Converting a Diagram</h2>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Take a photo or scan an existing process diagram</li>
          <li>Go to BPMN Generator</li>
          <li>Click on the "Attachment" tab</li>
          <li>Upload your image</li>
          <li>Review the preview and click "Generate BPMN from this file"</li>
          <li>Wait for processing (may take 1-2 minutes)</li>
          <li>Edit the converted diagram as needed</li>
        </ol>
      </section>
    </div>
  );
};

export default Tutorials;




