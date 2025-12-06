import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  BpmnModeler,
  DmnModeler,
  CustomBpmnJsModeler,
  CustomDmnJsModeler,
  Event,
  isContentSavedEvent
} from "@miragon/camunda-web-modeler";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import "@/styles/modeler-overrides.css";

type Props = {
  initialBpmnXml?: string;
  initialDmnXml?: string;
  onBpmnChange?: (xml: string) => void;
  onDmnChange?: (xml: string) => void;
  userId?: string;
  initialMode?: "bpmn" | "dmn"; // New prop to set initial mode
};

const INITIAL_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1" />
</bpmn:definitions>
`;

const INITIAL_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             xmlns:camunda="http://camunda.org/schema/1.0/dmn"
             id="definitions_1"
             name="Decision Table"
             namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="decision_1" name="Example decision">
    <decisionTable id="decisionTable_1">
      <!-- add rules from UI -->
    </decisionTable>
  </decision>
</definitions>
`;

const CombinedCamundaWebModeler: React.FC<Props> = ({
  initialBpmnXml = INITIAL_BPMN,
  initialDmnXml = INITIAL_DMN,
  onBpmnChange,
  onDmnChange,
  userId,
  initialMode = "bpmn" // Default to BPMN mode
}) => {
  const navigate = useNavigate();
  const [active, setActive] = useState<"bpmn" | "dmn">(initialMode);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [bpmnXml, setBpmnXml] = useState(initialBpmnXml);
  const [dmnXml, setDmnXml] = useState(initialDmnXml);

  // refs if you want to call .save()
  const bpmnRef = useRef<CustomBpmnJsModeler>();
  const dmnRef = useRef<CustomDmnJsModeler>();

  // === event handlers ===

  const handleBpmnEvent = useCallback(async (event: Event<any>) => {
    if (isContentSavedEvent(event)) {
      const newXml = event.data.xml;
      setBpmnXml(newXml);
      onBpmnChange?.(newXml);
      return;
    }
  }, [onBpmnChange]);

  const handleDmnEvent = useCallback(async (event: Event<any>) => {
    if (isContentSavedEvent(event)) {
      const newXml = event.data.xml;
      setDmnXml(newXml);
      onDmnChange?.(newXml);
      return;
    }
  }, [onDmnChange]);

  /**
   * CAUTION:
   * Wrap config in useMemo to avoid extra renders (library authors recommend this).
   */

  const bpmnModelerTabOptions = useMemo(
    () => ({
      modelerOptions: {
        // attach internal modeler instance to our ref
        refs: [bpmnRef],
      },
    }),
    []
  );

  const dmnModelerTabOptions = useMemo(
    () => ({
      modelerOptions: {
        refs: [dmnRef],
      },
    }),
    []
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a description for your diagram");
      return;
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to generate diagrams");
      navigate("/auth");
      return;
    }

    setIsGenerating(true);
    const diagramType = active === "bpmn" ? "BPMN" : "DMN";
    
    try {
      toast.info(`Generating ${diagramType} diagram...`);

      const { invokeFunction } = await import('@/utils/api-client');
      const functionName = active === 'dmn' ? 'generate-dmn' : 'generate-bpmn';
      
      const { data, error } = await invokeFunction(functionName, {
        prompt,
        diagramType: active === 'dmn' ? undefined : 'bpmn'
      }, { deduplicate: true });

      if (error) {
        console.error('Function error:', error);
        if (error.message?.includes('429')) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (error.message?.includes('402')) {
          toast.error("AI credits depleted. Please add more credits to continue.");
        } else {
          toast.error(`Failed to generate ${diagramType} diagram`);
        }
        return;
      }

      const xmlData = data?.bpmnXml || data?.dmnXml;
      if (xmlData) {
        if (active === "bpmn") {
          setBpmnXml(xmlData);
          onBpmnChange?.(xmlData);
        } else {
          setDmnXml(xmlData);
          onDmnChange?.(xmlData);
        }
        toast.success(`${diagramType} diagram generated successfully!`);
        setPrompt(""); // Clear prompt after successful generation
      } else {
        toast.error("No diagram data received");
      }
    } catch (err) {
      console.error('Error generating diagram:', err);
      toast.error("An error occurred while generating the diagram");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const ref = active === "bpmn" ? bpmnRef : dmnRef;
      if (ref.current) {
        const result = await ref.current.save({ format: true });
        const blob = new Blob([result.xml], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${active}-diagram.${active === 'bpmn' ? 'bpmn' : 'dmn'}`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(`${active.toUpperCase()} diagram downloaded`);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download diagram');
    }
  };

  const suggestionPrompts = active === "bpmn"
    ? [
        "Create a customer onboarding process",
        "Design an order fulfillment workflow",
        "Build a support ticket resolution process",
      ]
    : [
        "Create a loan approval decision table",
        "Design a pricing decision based on customer tier",
        "Build a risk assessment decision table",
      ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top control bar - Sticky */}
      <div className="sticky top-0 z-50 border-b border-border bg-card shadow-md">
        <div className="container mx-auto px-6 py-4">
          {/* Mode Header */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold">
              {active === "bpmn" ? "BPMN" : "DMN"} Modeler
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                Switch between BPMN and DMN using the tabs below
              </span>
            </h2>
          </div>

          {/* Tab Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button
                onClick={() => setActive("bpmn")}
                variant={active === "bpmn" ? "default" : "outline"}
                size="sm"
              >
                BPMN
              </Button>
              <Button
                onClick={() => setActive("dmn")}
                variant={active === "dmn" ? "default" : "outline"}
                size="sm"
              >
                DMN
              </Button>
            </div>

            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download {active.toUpperCase()}
            </Button>
          </div>

          {/* AI Generation Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">
                Generate {active === "bpmn" ? "BPMN" : "DMN"} with AI
              </h3>
            </div>

            {/* Suggestion Prompts */}
            <div className="flex flex-wrap gap-2">
              {suggestionPrompts.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt(suggestion)}
                  className="text-xs hover:bg-primary/10"
                  disabled={isGenerating}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {/* Prompt Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder={`Describe your ${active === "bpmn" ? "business process" : "decision logic"}...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
              />
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="gap-2 self-end"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modeler area */}
      <div className="flex-1 overflow-hidden bg-white">
        {active === "bpmn" && (
          <BpmnModeler
            xml={bpmnXml}
            onEvent={handleBpmnEvent}
            modelerTabOptions={bpmnModelerTabOptions}
          />
        )}

        {active === "dmn" && (
          <DmnModeler
            xml={dmnXml}
            onEvent={handleDmnEvent}
            modelerTabOptions={dmnModelerTabOptions}
          />
        )}
      </div>
    </div>
  );
};

export default CombinedCamundaWebModeler;
