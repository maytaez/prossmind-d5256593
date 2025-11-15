import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFreePrompts } from "@/hooks/useFreePrompts";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Mic, Send, Sparkles, MicOff, Languages, MessageSquare, Factory, FileText, File, Image } from "lucide-react";
import { motion } from "framer-motion";
import { scrollRevealVariants } from "@/hooks/useScrollReveal";
import { useReducedMotion, getReducedMotionTransition } from "@/hooks/useReducedMotion";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import BpmnViewerComponent from "./BpmnViewer";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnimatedTabs, AnimatedTabsList, AnimatedTabsTrigger, AnimatedTabsContent } from "@/components/ui/AnimatedTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const suggestionPrompts = [
  "Create a customer onboarding process",
  "Design an order fulfillment workflow",
  "Build a support ticket resolution process",
  "Generate an employee hiring workflow",
  "Create an invoice approval process",
];

const TryProssMe = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { remainingPrompts, hasUsedAllPrompts, usePrompt, isUnlimited } = useFreePrompts(!!user);
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<"bpmn" | "pid">("bpmn");
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    type: string;
    base64: string;
    extractedText?: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refinementStep, setRefinementStep] = useState<"idle" | "analyzing" | "refining" | "applying">("idle");
  const [generationStep, setGenerationStep] = useState<"idle" | "reading" | "generating" | "drawing">("idle");
  const [showRefineDialog, setShowRefineDialog] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load generated BPMN or P&ID from localStorage on mount
  useEffect(() => {
    const diagramType = localStorage.getItem('diagramType') || 'bpmn';
    const storageKey = diagramType === 'bpmn' ? 'generatedBpmn' : 'generatedPid';
    const generatedDiagram = localStorage.getItem(storageKey);
    
    if (generatedDiagram) {
      setBpmnXml(generatedDiagram);
      localStorage.removeItem(storageKey);
      localStorage.removeItem('diagramType');
      
      const diagramName = diagramType === 'bpmn' ? 'BPMN' : 'P&ID';
      toast.success(`Your generated ${diagramName} diagram is ready!`, {
        description: "You can now view and edit your process diagram"
      });
      
      // Scroll to the viewer
      setTimeout(() => {
        document.getElementById('bpmn-viewer')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 500);
    }
  }, []);

  // Subscribe to job status updates for Vision AI processing
  useEffect(() => {
    if (!currentJobId) return;

    // eslint-disable-next-line prefer-const
    let pollInterval: number | undefined;
    const checkJobStatus = async (): Promise<void> => {
      const { data, error } = await supabase
        .from('vision_bpmn_jobs')
        .select('status, bpmn_xml, error_message')
        .eq('id', currentJobId)
        .single();

      if (error) {
        console.error('Error checking job status:', error);
        return;
      }

      console.log('Job status:', data.status);

      if (data.status === 'completed' && data.bpmn_xml) {
        const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
        setBpmnXml(data.bpmn_xml);
        setGenerationStep("idle");
        setIsGenerating(false);
        setCurrentJobId(null);
        setShowPreview(false);
        setUploadedFile(null);
        toast.success(`${diagramName} diagram generated successfully!`);
        
        // Scroll to the viewer
        setTimeout(() => {
          document.getElementById('bpmn-viewer')?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 500);
        
        if (pollInterval) clearInterval(pollInterval);
      } else if (data.status === 'failed') {
        const errorMsg = data.error_message || "Processing failed. Please try again.";
        setGenerationStep("idle");
        setIsGenerating(false);
        setCurrentJobId(null);
        toast.error("Upload failed", {
          description: errorMsg,
          action: {
            label: "Retry",
            onClick: () => {
              // Retry will be handled by user clicking the button again
            }
          },
          duration: 10000
        });
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    // Try realtime subscription first
    const channel = supabase
      .channel(`job-${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vision_bpmn_jobs',
          filter: `id=eq.${currentJobId}`
        },
        (payload) => {
          const job = payload.new as { status: string; bpmn_xml?: string; error_message?: string };
          console.log('Realtime job status update:', job.status);

          if (job.status === 'completed' && job.bpmn_xml) {
            const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
            setBpmnXml(job.bpmn_xml);
            setGenerationStep("idle");
            setIsGenerating(false);
            setCurrentJobId(null);
            setShowPreview(false);
            setUploadedFile(null);
            toast.success(`${diagramName} diagram generated successfully!`);
            
            // Scroll to the viewer
            setTimeout(() => {
              document.getElementById('bpmn-viewer')?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
              });
            }, 500);
            
            if (pollInterval) clearInterval(pollInterval);
          } else if (job.status === 'failed') {
            const errorMsg = job.error_message || "Processing failed. Please try again.";
            setGenerationStep("idle");
            setIsGenerating(false);
            setCurrentJobId(null);
            toast.error("Upload failed", {
              description: errorMsg,
              action: {
                label: "Retry",
                onClick: () => {
                  if (uploadedFile) {
                    handleConfirmGeneration();
                  }
                }
              },
              duration: 10000
            });
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      )
      .subscribe();

    // Fallback: Poll every 3 seconds
    pollInterval = window.setInterval(checkJobStatus, 3000);
    // Check immediately
    checkJobStatus();
    
    // Set a timeout to stop polling after 5 minutes
    const timeoutId = window.setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      const errorMsg = "Processing timed out - Please try refreshing the page or contact support";
      setGenerationStep("idle");
      setIsGenerating(false);
      setCurrentJobId(null);
      toast.error("Upload failed", {
        description: errorMsg,
        action: {
          label: "Retry",
          onClick: () => {
            if (uploadedFile) {
              handleConfirmGeneration();
            }
          }
        },
        duration: 10000
      });
    }, 300000); // 5 minutes
    
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, diagramType, uploadedFile]);

  const handleGenerate = async (prompt: string) => {
    if (!prompt.trim()) {
      toast.error("Please enter a process description");
      return;
    }

    // Check free prompts for non-authenticated users
    if (!user && hasUsedAllPrompts) {
      toast.error("You've used all 5 free prompts. Please sign up to continue!");
      navigate("/auth");
      return;
    }

    if (!user) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      if (!usePrompt()) {
        toast.error("You've used all 5 free prompts. Please sign up to continue!");
        navigate("/auth");
        return;
      }
    }

    setIsGenerating(true);
    const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
    
    // Step 1: Reading prompt
    setGenerationStep("reading");
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Generating
    setGenerationStep("generating");

    try {
      const { data, error } = await supabase.functions.invoke('generate-bpmn', {
        body: { prompt, diagramType },
        headers: user ? undefined : { Authorization: '' }
      });

      if (error) {
        console.error('Function error:', error);
        setGenerationStep("idle");
        if (error.message?.includes('429')) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (error.message?.includes('402')) {
          toast.error("AI credits depleted. Please add more credits to continue.");
        } else {
          toast.error(`Failed to generate ${diagramName} model`);
        }
        return;
      }

      // Step 3: Drawing diagram
      setGenerationStep("drawing");
      await new Promise(resolve => setTimeout(resolve, 500));

      if (data?.bpmnXml) {
        setBpmnXml(data.bpmnXml);
        setGenerationStep("idle");
        toast.success(`${diagramName} model generated successfully!`);
      } else {
        setGenerationStep("idle");
        toast.error("No diagram data received");
      }
    } catch (err) {
      console.error('Error generating BPMN:', err);
      setGenerationStep("idle");
      toast.error("An error occurred while generating the model");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    handleGenerate(message);
    setMessage("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    const file = 'dataTransfer' in e ? e.dataTransfer.files?.[0] : e.target.files?.[0];
    if (!file) return;

    // Check authentication for document processing
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser) {
      toast.error("Please log in to upload and analyze documents");
      navigate("/auth");
      return;
    }

    const validTypes = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image, PDF, Word document, or text file");
      return;
    }

    setIsGenerating(true);
    const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
    toast.info(`Analyzing document and generating ${diagramName}...`);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const fileBase64 = reader.result as string;
      
      // Store file for preview
      setUploadedFile({
        name: file.name,
        type: file.type,
        base64: fileBase64,
      });
      
      setShowPreview(true);
      setIsGenerating(false);
      toast.success(`File uploaded! Review the preview before generating ${diagramName}.`);
    };

    reader.readAsDataURL(file);
  };

  const handleVoiceRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result?.toString().split(',')[1];
            
            try {
              // Call speech-to-text edge function with language parameter
              const { data, error } = await supabase.functions.invoke('speech-to-text', {
                body: { 
                  audio: base64Audio,
                  language: language
                },
                headers: user ? undefined : { Authorization: '' }
              });

              if (error) throw error;
              
              if (data?.text) {
                setMessage(data.text);
                toast.success("Voice recorded successfully!");
              }
            } catch (error) {
              console.error('Speech-to-text error:', error);
              toast.error("Failed to convert speech to text.");
            }
          };
          
          // Stop all tracks after processing
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        toast.info("Recording... Click again to stop");
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error("Could not access microphone. Please check permissions.");
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all audio tracks immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setIsRecording(false);
      mediaRecorderRef.current = null;
    }
  };

  const handleConfirmGeneration = async () => {
    if (!uploadedFile) return;

    setIsGenerating(true);
    setShowPreview(false);
    const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
    
    // Step 1: Reading prompt
    setGenerationStep("reading");
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Generating
    setGenerationStep("generating");

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setGenerationStep("idle");
        toast.error("Please log in to continue");
        navigate("/auth");
        return;
      }

      // Validate file size (200 MB = 200 * 1024 * 1024 bytes)
      const fileSize = uploadedFile.base64.length * 0.75; // Approximate size from base64
      const maxSize = 200 * 1024 * 1024;
      if (fileSize > maxSize) {
        setGenerationStep("idle");
        setIsGenerating(false);
        toast.error("File too large", {
          description: "Maximum file size is 200 MB. Please select a smaller file."
        });
        return;
      }

      const loadingToast = toast.loading("Processing your file...", {
        description: "This may take 30-60 seconds for complex diagrams"
      });

      // Call vision-to-bpmn function (same as Vision AI)
      const { data, error } = await supabase.functions.invoke('vision-to-bpmn', {
        body: {
          imageBase64: uploadedFile.base64,
          diagramType
        },
        headers: user ? undefined : { Authorization: '' }
      });

      toast.dismiss(loadingToast);

      if (error) {
        console.error('Vision AI error:', error);
        setGenerationStep("idle");
        setIsGenerating(false);
        const errorMsg = error.message || "Failed to start diagram generation";
        toast.error("Upload failed", {
          description: errorMsg,
          action: {
            label: "Retry",
            onClick: () => {
              handleConfirmGeneration();
            }
          },
          duration: 10000
        });
        return;
      }

      if (!data || !data.jobId) {
        setGenerationStep("idle");
        setIsGenerating(false);
        toast.error("Upload failed", {
          description: "Failed to start processing",
          action: {
            label: "Retry",
            onClick: () => {
              handleConfirmGeneration();
            }
          },
          duration: 10000
        });
        return;
      }

      // Set job ID to start listening for updates
      setCurrentJobId(data.jobId);
      setGenerationStep("generating");
      
      toast.info("Processing started", {
        description: "We'll notify you when your diagram is ready (this may take 1-2 minutes)"
      });
    } catch (error) {
      console.error('Vision AI processing error:', error);
      setGenerationStep("idle");
      setIsGenerating(false);
      const errorMsg = error instanceof Error ? error.message : "Network error - Please check your connection and try again";
      toast.error("Upload failed", {
        description: errorMsg,
        action: {
          label: "Retry",
          onClick: () => {
            handleConfirmGeneration();
          }
        },
        duration: 10000
      });
    }
  };

  const handleRefineBpmn = async () => {
    if (!bpmnXml || !refinementPrompt.trim()) {
      const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
      toast.error(`Please enter instructions to refine the ${diagramName}`);
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
      toast.error(`Please log in to refine ${diagramName}`);
      navigate("/auth");
      return;
    }

    setIsRefining(true);
    const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
    toast.info(`Refining ${diagramName} based on your instructions...`);

    // Step 1: Analyzing instructions
    setRefinementStep("analyzing");
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Refining diagram
    setRefinementStep("refining");

    try {
      const { data, error } = await supabase.functions.invoke('refine-bpmn', {
        body: {
          currentBpmnXml: bpmnXml,
          instructions: refinementPrompt,
          userId: currentUser.id,
          diagramType
        },
        headers: user ? undefined : { Authorization: '' }
      });

      // Check for errors in both error field and data.error
      if (error) {
        console.error('Refinement error:', error);
        setRefinementStep("idle");
        const errorMessage = error.message || JSON.stringify(error);
        if (errorMessage.includes('429')) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (errorMessage.includes('402')) {
          toast.error("AI credits depleted. Please add more credits to continue.");
        } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
          toast.error("Authentication required. Please log in again.");
          navigate("/auth");
        } else {
          toast.error(`Failed to refine ${diagramName}: ${errorMessage}`);
        }
        return;
      }

      // Check if the response itself contains an error
      if (data?.error) {
        console.error('Refinement error in response:', data.error);
        setRefinementStep("idle");
        const errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        if (errorMessage.includes('402')) {
          toast.error("AI credits depleted. Please add more credits to continue.");
        } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
          toast.error("Authentication required. Please log in again.");
          navigate("/auth");
        } else {
          toast.error(`Failed to refine ${diagramName}: ${errorMessage}`);
        }
        return;
      }

      if (data?.bpmnXml) {
        // Step 3: Applying changes
        setRefinementStep("applying");
        await new Promise(resolve => setTimeout(resolve, 300));

        // Validate that we received valid XML before updating (accept both </bpmn:definitions> and </definitions>)
        const hasValidClosing = data.bpmnXml.includes('</bpmn:definitions>') || data.bpmnXml.includes('</definitions>');
        if (data.bpmnXml.includes('<?xml') && hasValidClosing) {
          setBpmnXml(data.bpmnXml);
          setRefinementStep("idle");
          toast.success(`${diagramName} refined successfully!`);
          setRefinementPrompt("");
        } else {
          console.error('Received invalid diagram XML:', data.bpmnXml.substring(0, 200));
          setRefinementStep("idle");
          toast.error("Received invalid diagram structure. Please try again.");
        }
      } else {
        console.error('No refined diagram received. Response:', data);
        setRefinementStep("idle");
        toast.error("No refined diagram received. The function may not be deployed or there was an error.");
      }
    } catch (error) {
      console.error('BPMN refinement error:', error);
      setRefinementStep("idle");
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('load the resource')) {
        toast.error(`Network error: Unable to reach refine-bpmn function. Please check if the function is deployed.`);
      } else {
        toast.error(`Failed to refine ${diagramType === "bpmn" ? "BPMN" : "P&ID"}: ${errorMessage}`);
      }
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <section className="py-24 bg-muted/20 relative" data-section="try-prossmind">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center mb-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={scrollRevealVariants}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Try <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">ProssMind!</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Describe your business process, upload an image, PDF, Word doc, or text file - AI will generate a BPMN or P&ID diagram for you
          </p>
        </motion.div>
        
        <div className="max-w-5xl mx-auto mt-12 space-y-8">
          <AnimatedTabs value={diagramType} onValueChange={(v) => setDiagramType(v as "bpmn" | "pid")} className="w-full">
            <AnimatedTabsList className={`grid w-full max-w-md mx-auto grid-cols-2 mb-8 ${diagramType === "pid" ? 'bg-engineering-green/10' : ''}`}>
              <AnimatedTabsTrigger 
                value="bpmn"
                className={`${diagramType === "bpmn" ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" : ""}`}
              >
                BPMN Diagram
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger 
                value="pid"
                className={`${diagramType === "pid" ? "data-[state=active]:bg-engineering-green data-[state=active]:text-white" : ""}`}
              >
                <Factory className="h-4 w-4 mr-2 flex-shrink-0" />
                P&ID Diagram
              </AnimatedTabsTrigger>
            </AnimatedTabsList>
            
            <AnimatedTabsContent value="bpmn" className="space-y-8">
              {/* Suggestion Prompts */}
              <div className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl p-8 border border-border/50 slide-up stagger-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Try these BPMN examples:</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {suggestionPrompts.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-sm hover:bg-primary/10 hover:border-primary/50 transition-all whitespace-nowrap"
                      disabled={isGenerating}
                      style={{ minWidth: 'max-content', paddingLeft: '1.2em', paddingRight: '1.2em' }}
                      aria-label={`Use suggestion: ${suggestion}`}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              <div className="bg-card border border-border rounded-2xl p-8 shadow-xl slide-up stagger-2">
            <div className="space-y-6">
              {/* Segmented Control Style Tabs for Input Methods */}
              <Tabs defaultValue="prompt" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                  <TabsTrigger value="prompt" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Prompt</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Mic className="h-4 w-4" />
                    <span className="hidden sm:inline">Voice</span>
                  </TabsTrigger>
                  <TabsTrigger value="attachment" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Paperclip className="h-4 w-4" />
                    <span className="hidden sm:inline">Attachment</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="prompt" className="mt-4">
                  <div className="relative">
                    <Textarea
                      placeholder="Describe your process step by step..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[120px] resize-none border-muted"
                      style={{ paddingLeft: '1.2em', paddingRight: '1.2em' }}
                      disabled={isGenerating}
                    />
                    {isGenerating && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1">
                        <motion.span
                          className="w-2 h-2 bg-primary rounded-full"
                          animate={prefersReducedMotion ? {} : {
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={getReducedMotionTransition(prefersReducedMotion) || {
                            duration: 1,
                            repeat: Infinity,
                            delay: 0,
                          }}
                        />
                        <motion.span
                          className="w-2 h-2 bg-primary rounded-full"
                          animate={prefersReducedMotion ? {} : {
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={getReducedMotionTransition(prefersReducedMotion) || {
                            duration: 1,
                            repeat: Infinity,
                            delay: 0.2,
                          }}
                        />
                        <motion.span
                          className="w-2 h-2 bg-primary rounded-full"
                          animate={prefersReducedMotion ? {} : {
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={getReducedMotionTransition(prefersReducedMotion) || {
                            duration: 1,
                            repeat: Infinity,
                            delay: 0.4,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="voice" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-[200px] h-8">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="en-GB">English (UK)</SelectItem>
                          <SelectItem value="es-ES">Spanish</SelectItem>
                          <SelectItem value="fr-FR">French</SelectItem>
                          <SelectItem value="de-DE">German</SelectItem>
                          <SelectItem value="it-IT">Italian</SelectItem>
                          <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                          <SelectItem value="pt-PT">Portuguese (Portugal)</SelectItem>
                          <SelectItem value="ru-RU">Russian</SelectItem>
                          <SelectItem value="ja-JP">Japanese</SelectItem>
                          <SelectItem value="ko-KR">Korean</SelectItem>
                          <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                          <SelectItem value="zh-TW">Chinese (Traditional)</SelectItem>
                          <SelectItem value="ar-SA">Arabic</SelectItem>
                          <SelectItem value="hi-IN">Hindi</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">Voice recognition language</span>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={handleVoiceRecording}
                      disabled={isGenerating}
                      className={isRecording ? "text-red-500 border-red-500" : "w-full"}
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="h-4 w-4 mr-2 animate-pulse" />
                          Click to Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" />
                          Start Voice Recording
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="attachment" className="mt-4">
                  <div className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        handleFileUpload(e);
                      }}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                        isDragOver
                          ? "border-primary bg-primary/5 scale-[1.02]"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex justify-center gap-4 mb-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Image className="h-5 w-5" aria-hidden="true" />
                          <span className="text-xs">PNG/JPG</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <FileText className="h-5 w-5" aria-hidden="true" />
                          <span className="text-xs">PDF</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <File className="h-5 w-5" aria-hidden="true" />
                          <span className="text-xs">DOCX</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isGenerating}
                        className="w-full"
                        aria-label="Upload file"
                      >
                        <Paperclip className="h-4 w-4 mr-2" aria-hidden="true" />
                        Upload File
                      </Button>
                      <p className="text-xs text-muted-foreground mt-3">
                        Drag and drop a file here or click to browse
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* 3-Step Progress Indicator */}
              {isGenerating && generationStep !== "idle" && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm font-medium text-foreground mb-2">Processing your document...</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className={generationStep === "reading" ? "font-semibold" : "text-muted-foreground"}>
                      {generationStep === "reading" && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" aria-hidden="true" />}
                      {generationStep !== "reading" && "✓ "}
                      Step 1: Reading prompt...
                    </span>
                    {generationStep === "reading" && <Progress value={33} className="w-24" aria-label="Progress: 33%" />}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={generationStep === "generating" ? "font-semibold" : generationStep === "drawing" ? "text-muted-foreground" : ""}>
                      {generationStep === "generating" && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" aria-hidden="true" />}
                      {generationStep !== "generating" && generationStep !== "reading" && "✓ "}
                      Step 2: Generating...
                    </span>
                    {generationStep === "generating" && <Progress value={66} className="w-24" aria-label="Progress: 66%" />}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={generationStep === "drawing" ? "font-semibold" : "text-muted-foreground"}>
                      {generationStep === "drawing" && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" aria-hidden="true" />}
                      {generationStep !== "drawing" && generationStep !== "generating" && generationStep !== "reading" && "✓ "}
                      Step 3: Drawing Diagram...
                    </span>
                    {generationStep === "drawing" && <Progress value={100} className="w-24" aria-label="Progress: 100%" />}
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleSend} 
                className="gap-2 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all w-full"
                size="lg"
                disabled={isGenerating || !message.trim()}
                aria-label="Generate BPMN diagram"
              >
                {isGenerating ? "Generating..." : "Generate BPMN"}
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          </AnimatedTabsContent>

          <AnimatedTabsContent value="pid" className="space-y-8">
            {/* Suggestion Prompts for P&ID */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl p-8 border border-border/50 slide-up stagger-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-full bg-primary/10 p-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Try these P&ID examples:</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {["Create a chemical reactor cooling system", "Design a water treatment process flow", "Build a distillation column control loop", "Generate a pump and valve configuration", "Create a heat exchanger system"].map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-sm hover:bg-primary/10 hover:border-primary/50 transition-all"
                    disabled={isGenerating}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-xl slide-up stagger-2">
              <div className="space-y-6">
                {/* Language Selector for Voice Input */}
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-[200px] h-8" aria-label="Select voice recognition language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                      <SelectItem value="es-ES">Spanish</SelectItem>
                      <SelectItem value="fr-FR">French</SelectItem>
                      <SelectItem value="de-DE">German</SelectItem>
                      <SelectItem value="it-IT">Italian</SelectItem>
                      <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                      <SelectItem value="pt-PT">Portuguese (Portugal)</SelectItem>
                      <SelectItem value="ru-RU">Russian</SelectItem>
                      <SelectItem value="ja-JP">Japanese</SelectItem>
                      <SelectItem value="ko-KR">Korean</SelectItem>
                      <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                      <SelectItem value="zh-TW">Chinese (Traditional)</SelectItem>
                      <SelectItem value="ar-SA">Arabic</SelectItem>
                      <SelectItem value="hi-IN">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">Voice recognition language</span>
                </div>
                
                <Textarea
                  placeholder="Describe your P&ID process, or upload files (images, PDFs, Word docs, text files) - I'll extract content and generate a P&ID diagram. You can preview before generation and refine using natural language after creation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[120px] resize-none border-muted"
                  disabled={isGenerating}
                  aria-label="P&ID process description input"
                />
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      aria-label="Upload file input"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating}
                      title="Upload image, PDF, Word, or text file to generate P&ID"
                      aria-label="Upload file"
                    >
                      <Paperclip className="h-5 w-5" aria-hidden="true" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleVoiceRecording}
                      disabled={isGenerating}
                      className={isRecording ? "text-red-500" : ""}
                      title="Voice to text"
                      aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
                    >
                      {isRecording ? <MicOff className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={handleSend} 
                    className="gap-2 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
                    size="lg"
                    disabled={isGenerating || !message.trim()}
                    aria-label="Generate P&ID diagram"
                  >
                    {isGenerating ? "Generating..." : "Generate P&ID"}
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                
                <div className="border border-border rounded-lg p-4 bg-muted/30">
                  <div className="flex justify-center gap-4 mb-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Image className="h-4 w-4" aria-hidden="true" />
                      <span className="text-xs">PNG/JPG</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      <span className="text-xs">PDF</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <File className="h-4 w-4" aria-hidden="true" />
                      <span className="text-xs">DOCX</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Supported file types for upload
                  </p>
                </div>
              </div>
            </div>
          </AnimatedTabsContent>
          </AnimatedTabs>

          {/* File Preview Modal */}
          {showPreview && uploadedFile && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Preview Uploaded File</h3>
              
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">File: {uploadedFile.name}</p>
                  
                  {uploadedFile.type.startsWith('image/') && (
                    <div className="mt-4 max-h-96 overflow-auto">
                      <img 
                        src={uploadedFile.base64} 
                        alt="Preview" 
                        className="max-w-full rounded border"
                      />
                    </div>
                  )}
                  
                  {uploadedFile.extractedText && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Extracted Content Preview:</p>
                      <div className="bg-background rounded p-3 max-h-48 overflow-auto text-xs">
                        {uploadedFile.extractedText}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleConfirmGeneration}
                    className="flex-1"
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating..." : `Generate ${diagramType === "bpmn" ? "BPMN" : "P&ID"} from this file`}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowPreview(false);
                      setUploadedFile(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BPMN Editor with Refinement */}
          {bpmnXml ? (
            <div id="bpmn-viewer" className="space-y-6 relative">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                <h3 className="text-xl font-semibold mb-4">Your {diagramType === "bpmn" ? "BPMN" : "P&ID"} Model</h3>
                <BpmnViewerComponent 
                  xml={bpmnXml}
                  diagramType={diagramType}
                  onSave={(updatedXml) => {
                    setBpmnXml(updatedXml);
                    toast.success("Diagram saved to workspace");
                  }}
                  onRefine={() => setShowRefineDialog(true)}
                />
                {/* Model Feedback */}
                <p className="text-xs text-muted-foreground mt-4 text-right">
                  Generated via Gemini 2.5 Pro · v1
                </p>
              </div>

              {/* Refinement Progress Indicator */}
              {isRefining && refinementStep !== "idle" && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm font-medium text-foreground mb-2">Refining your {diagramType === "bpmn" ? "BPMN" : "P&ID"} diagram...</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className={refinementStep === "analyzing" ? "font-semibold" : "text-muted-foreground"}>
                      {refinementStep === "analyzing" && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" aria-hidden="true" />}
                      {refinementStep !== "analyzing" && "✓ "}
                      Step 1: Analyzing instructions...
                    </span>
                    {refinementStep === "analyzing" && <Progress value={33} className="w-24" aria-label="Progress: 33%" />}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={refinementStep === "refining" ? "font-semibold" : refinementStep === "applying" ? "text-muted-foreground" : ""}>
                      {refinementStep === "refining" && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" aria-hidden="true" />}
                      {refinementStep !== "refining" && refinementStep !== "analyzing" && "✓ "}
                      Step 2: Refining diagram...
                    </span>
                    {refinementStep === "refining" && <Progress value={66} className="w-24" aria-label="Progress: 66%" />}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={refinementStep === "applying" ? "font-semibold" : "text-muted-foreground"}>
                      {refinementStep === "applying" && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" aria-hidden="true" />}
                      {refinementStep !== "applying" && refinementStep !== "refining" && refinementStep !== "analyzing" && "✓ "}
                      Step 3: Applying changes...
                    </span>
                    {refinementStep === "applying" && <Progress value={100} className="w-24" aria-label="Progress: 100%" />}
                  </div>
                </div>
              )}

              {/* Refinement Dialog */}
              <Dialog open={showRefineDialog} onOpenChange={setShowRefineDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Refine Your {diagramType === "bpmn" ? "BPMN" : "P&ID"}</DialogTitle>
                    <DialogDescription>
                      Use natural language to modify the current diagram. The AI will update the latest version based on your instructions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="E.g., 'add a review step after approval', 'replace manual task with automated service', 'add parallel gateway for concurrent processing'..."
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      className="min-h-[100px] resize-none"
                      disabled={isRefining}
                    />
                    
                    <Button 
                      onClick={() => {
                        handleRefineBpmn();
                        setShowRefineDialog(false);
                      }}
                      disabled={isRefining || !refinementPrompt.trim()}
                      className="w-full"
                    >
                      {isRefining ? "Refining..." : `Apply Changes to Current ${diagramType === "bpmn" ? "BPMN" : "P&ID"}`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : isGenerating && generationStep === "drawing" ? (
            <motion.div 
              className="bg-card border border-border rounded-2xl p-6 shadow-lg"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={getReducedMotionTransition(prefersReducedMotion) || { duration: 0.3 }}
            >
              <h3 className="text-xl font-semibold mb-4">Generating {diagramType === "bpmn" ? "BPMN" : "P&ID"} Model</h3>
              <div className="space-y-4">
                {/* Skeleton loader for BPMN preview */}
                <div className="w-full h-[400px] bg-muted/50 rounded-lg animate-pulse border border-border/50 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Rendering diagram...</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default TryProssMe;
