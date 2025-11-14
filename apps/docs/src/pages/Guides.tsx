const Guides = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Guides</h1>
        <p className="text-xl text-muted-foreground">
          Comprehensive guides for using ProssMind features.
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">BPMN Generator Guide</h2>
        <p className="mb-4">
          Learn how to create business process diagrams using natural language descriptions.
        </p>
        <h3 className="text-xl font-semibold mb-2">Input Methods</h3>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li><strong>Text Prompt:</strong> Describe your process in plain English</li>
          <li><strong>Voice Input:</strong> Speak your process description (supports multiple languages)</li>
          <li><strong>File Upload:</strong> Upload images, PDFs, Word documents, or text files</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">P&ID Generator Guide</h2>
        <p className="mb-4">
          Create piping and instrumentation diagrams for engineering processes.
        </p>
        <p className="mb-4">
          The P&ID generator works similarly to the BPMN generator but is optimized for engineering diagrams with specialized symbols and components.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Vision AI Guide</h2>
        <p className="mb-4">
          Upload images of existing diagrams or process documentation, and ProssMind will automatically convert them to editable BPMN or P&ID formats.
        </p>
        <h3 className="text-xl font-semibold mb-2">Supported Formats</h3>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>PNG, JPG, JPEG, WebP images</li>
          <li>PDF documents</li>
          <li>Word documents (.doc, .docx)</li>
          <li>Plain text files</li>
        </ul>
      </section>
    </div>
  );
};

export default Guides;




