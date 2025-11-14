const Faq = () => {
  const faqs = [
    {
      question: "How many free prompts do I get?",
      answer: "Non-authenticated users get 5 free prompts. After signing up, you get unlimited prompts based on your plan.",
    },
    {
      question: "What file formats are supported?",
      answer: "We support PNG, JPG, JPEG, WebP images, PDF documents, Word documents (.doc, .docx), and plain text files.",
    },
    {
      question: "How long does diagram generation take?",
      answer: "Text-based generation typically takes 10-30 seconds. File uploads may take 1-2 minutes depending on complexity.",
    },
    {
      question: "Can I edit generated diagrams?",
      answer: "Yes! All generated diagrams are fully editable using the built-in BPMN editor.",
    },
    {
      question: "Is my data secure?",
      answer: "Yes, ProssMind is GDPR compliant and processes data securely in Switzerland. Your diagrams are private and only accessible to you.",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-xl text-muted-foreground">
          Common questions about ProssMind.
        </p>
      </div>

      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <div key={index} className="border-b pb-6">
            <h2 className="text-xl font-semibold mb-2">{faq.question}</h2>
            <p className="text-muted-foreground">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Faq;




