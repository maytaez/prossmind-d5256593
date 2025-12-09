import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const faqs = [
    {
      question: "How many free diagrams can I create?",
      answer: "Free accounts include 5 diagram generations. After that, you can upgrade to a paid plan for unlimited diagrams.",
    },
    {
      question: "What file formats can I export?",
      answer: "You can export diagrams in BPMN 2.0 XML, PNG, SVG, and PDF formats.",
    },
    {
      question: "Can I use Vision AI with handwritten notes?",
      answer: "Yes! Vision AI can convert handwritten notes, whiteboard sketches, and printed documents into professional diagrams.",
    },
    {
      question: "Is my data secure?",
      answer: "Yes, all data is encrypted and securely stored. We never share your data with third parties.",
    },
    {
      question: "Can I integrate with SAP Signavio?",
      answer: "Yes, you can export BPMN diagrams in a format compatible with SAP Signavio, Camunda, and Flowable.",
    },
    {
      question: "What's the difference between BPMN and P&ID?",
      answer: "BPMN (Business Process Model and Notation) is for business processes, while P&ID (Piping and Instrumentation Diagram) is for engineering and manufacturing processes.",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-xl text-muted-foreground">
          Find answers to common questions about ProssMind.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default FAQ;





