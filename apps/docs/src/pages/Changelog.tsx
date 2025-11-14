const Changelog = () => {
  const versions = [
    {
      version: "1.0.0",
      date: "2024-01-01",
      changes: [
        "Initial release",
        "BPMN diagram generation",
        "P&ID diagram generation",
        "Vision AI file upload",
        "Voice input support",
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Changelog</h1>
        <p className="text-xl text-muted-foreground">
          Version history and updates.
        </p>
      </div>

      <div className="space-y-8">
        {versions.map((version) => (
          <div key={version.version} className="border-b pb-6">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-2xl font-semibold">v{version.version}</h2>
              <span className="text-muted-foreground">{version.date}</span>
            </div>
            <ul className="list-disc list-inside space-y-2 ml-4">
              {version.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Changelog;




