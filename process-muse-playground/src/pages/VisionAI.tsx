import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Eye, Camera, Scan, Image as ImageIcon, Upload, FileText, ImageIcon as ImageFileIcon, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VisionAI = () => {
  const [showDemo, setShowDemo] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<"bpmn" | "pid">("bpmn");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to job status updates with polling fallback
  useEffect(() => {
    if (!currentJobId) return;

    // eslint-disable-next-line prefer-const
    let pollInterval: number | undefined;
    const checkJobStatus = async () => {
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
        // Store the result based on diagram type
        const storageKey = diagramType === "bpmn" ? 'generatedBpmn' : 'generatedPid';
        localStorage.setItem(storageKey, data.bpmn_xml);
        localStorage.setItem('diagramType', diagramType);
        
        const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
        setUploadProgress(100);
        setProgressText("Complete!");
        
        // Auto-redirect after 2s with countdown
        let countdown = 2;
        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            toast.success(`${diagramName} diagram generated successfully!`, {
              description: `Redirecting in ${countdown}s...`,
              duration: 1000,
            });
          } else {
            clearInterval(countdownInterval);
            window.location.href = '/';
          }
        }, 1000);
        
        setShowUpload(false);
        setSelectedFile(null);
        setProcessing(false);
        setCurrentJobId(null);
        setErrorMessage(null);
        if (pollInterval) clearInterval(pollInterval);
      } else if (data.status === 'failed') {
        const errorMsg = data.error_message || "Please try again";
        setErrorMessage(errorMsg);
        toast.error("Upload failed – retry or contact support", {
          description: errorMsg,
          action: {
            label: "Retry",
            onClick: () => {
              setErrorMessage(null);
              if (selectedFile) {
                handleUpload();
              }
            }
          },
          duration: 10000
        });
        setProcessing(false);
        setCurrentJobId(null);
        setUploadProgress(0);
        setProgressText("");
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
            const storageKey = diagramType === "bpmn" ? 'generatedBpmn' : 'generatedPid';
            localStorage.setItem(storageKey, job.bpmn_xml);
            localStorage.setItem('diagramType', diagramType);
            
            const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
            setUploadProgress(100);
            setProgressText("Complete!");
            
            // Auto-redirect after 2s with countdown
            let countdown = 2;
            const countdownInterval = setInterval(() => {
              countdown--;
              if (countdown > 0) {
                toast.success(`${diagramName} diagram generated successfully!`, {
                  description: `Redirecting in ${countdown}s...`,
                  duration: 1000,
                });
              } else {
                clearInterval(countdownInterval);
                window.location.href = '/';
              }
            }, 1000);
            
            setShowUpload(false);
            setSelectedFile(null);
            setProcessing(false);
            setCurrentJobId(null);
            setErrorMessage(null);
            if (pollInterval) clearInterval(pollInterval);
          } else if (job.status === 'failed') {
            const errorMsg = job.error_message || "Please try again";
            setErrorMessage(errorMsg);
            toast.error("Upload failed – retry or contact support", {
              description: errorMsg,
              action: {
                label: "Retry",
                onClick: () => {
                  setErrorMessage(null);
                  if (selectedFile) {
                    handleUpload();
                  }
                }
              },
              duration: 10000
            });
            setProcessing(false);
            setCurrentJobId(null);
            setUploadProgress(0);
            setProgressText("");
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      )
      .subscribe();

    // Fallback: Poll every 3 seconds with longer timeout
    pollInterval = window.setInterval(checkJobStatus, 3000);
    // Check immediately
    checkJobStatus();
    
    // Set a timeout to stop polling after 5 minutes
    const timeoutId = window.setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      const errorMsg = "Processing timed out - Please try refreshing the page or contact support";
      setErrorMessage(errorMsg);
      setUploadProgress(0);
      setProgressText("");
      toast.error("Upload failed – retry or contact support", {
        description: errorMsg,
        action: {
          label: "Retry",
          onClick: () => {
            setErrorMessage(null);
            if (selectedFile) {
              handleUpload();
            }
          }
        },
        duration: 10000
      });
      setProcessing(false);
      setCurrentJobId(null);
    }, 300000); // 5 minutes
    
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, diagramType, selectedFile]);

  const handleGetStarted = () => {
    setShowDemo(true);
  };

  const handleDemoComplete = () => {
    setShowDemo(false);
    setShowUpload(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (200 MB = 200 * 1024 * 1024 bytes)
      const maxSize = 200 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error("File too large", {
          description: "Maximum file size is 200 MB. Please select a smaller file."
        });
        event.target.value = "";
        return;
      }
      
      setSelectedFile(file);
      setErrorMessage(null);
      // Optimistic progress: 0-10% immediately
      setUploadProgress(10);
      setProgressText("File selected, ready to upload...");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    // Reset states
    setProcessing(true);
    setErrorMessage(null);
    setUploadProgress(10);
    setProgressText("Analyzing frame 1 of 20...");
    
    // Show a loading toast that persists
    const loadingToast = toast.loading("Processing your file...", {
      description: "This may take 30-60 seconds for complex diagrams"
    });
    
    try {
      // Get current user with detailed logging
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!user || userError) {
        toast.dismiss(loadingToast);
        const errorMsg = userError?.message || "Please log in to use this feature";
        setErrorMessage(errorMsg);
        toast.error("Upload failed – retry or contact support", {
          description: errorMsg,
          action: {
            label: "Retry",
            onClick: () => {
              setErrorMessage(null);
              handleUpload();
            }
          },
          duration: 10000
        });
        setProcessing(false);
        setUploadProgress(0);
        setProgressText("");
        window.location.href = '/auth';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Content = reader.result as string;
        
        toast.dismiss(loadingToast);
        setUploadProgress(20);
        setProgressText("Uploading file...");
        
        const processingToast = toast.loading("Starting diagram generation...", {
          description: "This will continue in the background"
        });
        
        try {
          const { data, error } = await supabase.functions.invoke('vision-to-bpmn', {
            body: {
              imageBase64: base64Content
            }
          });

          toast.dismiss(processingToast);

          if (error) {
            const errorMsg = error.message || "Failed to start diagram generation";
            setErrorMessage(errorMsg);
            setUploadProgress(0);
            setProgressText("");
            toast.error("Upload failed – retry or contact support", {
              description: errorMsg,
              action: {
                label: "Retry",
                onClick: () => {
                  setErrorMessage(null);
                  handleUpload();
                }
              },
              duration: 10000
            });
            setProcessing(false);
            return;
          }

          if (!data || !data.jobId) {
            const errorMsg = "Failed to start processing";
            setErrorMessage(errorMsg);
            setUploadProgress(0);
            setProgressText("");
            toast.error("Upload failed – retry or contact support", {
              description: errorMsg,
              action: {
                label: "Retry",
                onClick: () => {
                  setErrorMessage(null);
                  handleUpload();
                }
              },
              duration: 10000
            });
            setProcessing(false);
            return;
          }

          // Set job ID to start listening for updates
          setCurrentJobId(data.jobId);
          setUploadProgress(30);
          setProgressText("Processing started, analyzing frames...");
          
          toast.info("Processing started", {
            description: "We'll notify you when your diagram is ready (this may take 1-2 minutes)"
          });
        } catch (invokeError) {
          const errorMsg = "Network error - Please check your connection and try again";
          setErrorMessage(errorMsg);
          setUploadProgress(0);
          setProgressText("");
          toast.dismiss(processingToast);
          toast.error("Upload failed – retry or contact support", {
            description: errorMsg,
            action: {
              label: "Retry",
              onClick: () => {
                setErrorMessage(null);
                handleUpload();
              }
            },
            duration: 10000
          });
          setProcessing(false);
        }
      };
      
      reader.onerror = () => {
        const errorMsg = "Failed to read file";
        setErrorMessage(errorMsg);
        setUploadProgress(0);
        setProgressText("");
        toast.dismiss(loadingToast);
        toast.error("Upload failed – retry or contact support", {
          description: errorMsg,
          action: {
            label: "Retry",
            onClick: () => {
              setErrorMessage(null);
              handleUpload();
            }
          },
          duration: 10000
        });
        setProcessing(false);
      };
      
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to generate diagram";
      setErrorMessage(errorMsg);
      setUploadProgress(0);
      setProgressText("");
      toast.dismiss(loadingToast);
      toast.error("Upload failed – retry or contact support", {
        description: errorMsg,
        action: {
          label: "Retry",
          onClick: () => {
            setErrorMessage(null);
            handleUpload();
          }
        },
        duration: 10000
      });
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <Eye className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-5xl font-bold mb-4">
              Vision <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              See what computers see. Our advanced vision AI technology enables your automation to understand and process visual information just like humans do.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Self-Learning Vision System</h2>
              <p className="text-lg text-muted-foreground">
                Our Vision AI continuously learns and adapts to your specific use cases, improving accuracy and performance over time without manual intervention.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Camera className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Real-time Processing</h3>
                    <p className="text-sm text-muted-foreground">Process images and video streams in real-time with minimal latency</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Scan className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Object Detection</h3>
                    <p className="text-sm text-muted-foreground">Identify and track multiple objects across frames</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <ImageIcon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Image Classification</h3>
                    <p className="text-sm text-muted-foreground">Automatically categorize and tag visual content</p>
                  </div>
                </li>
              </ul>
              <Button size="lg" className="mt-6" onClick={handleGetStarted}>
                Start Free Trial
              </Button>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-12 text-center">
              <Eye className="h-32 w-32 mx-auto text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-4">100% Client-Side Processing</h3>
              <p className="text-muted-foreground">
                All vision processing happens on your device. Your data never leaves your control, ensuring maximum privacy and security.
              </p>
            </div>
          </div>

          <div className="bg-hero-bg text-hero-foreground rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to See the Future?</h2>
            <p className="text-xl text-hero-foreground/80 mb-8 max-w-2xl mx-auto">
              Join thousands of companies already using ProssMind Vision AI to transform their automation workflows
            </p>
            <Button size="lg" variant="secondary" className="text-lg px-8" onClick={handleGetStarted}>
              Get Started Now
            </Button>
          </div>
        </div>
      </main>

      {/* Demo Video Dialog */}
      <Dialog open={showDemo} onOpenChange={setShowDemo}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>See Vision AI in Action</DialogTitle>
            <DialogDescription>
              Watch how Vision AI transforms handwritten notes, whiteboard diagrams, and process sketches into professional BPMN diagrams
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/gvwvmUy_wrw"
              title="BPMN Process Modeling Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={handleDemoComplete}>
              Skip Demo
            </Button>
            <Button onClick={handleDemoComplete}>
              Try It Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Your Process</DialogTitle>
            <DialogDescription>
              Upload handwritten notes, whiteboard images, process documents, or text files to generate a diagram
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Tabs value={diagramType} onValueChange={(v) => setDiagramType(v as "bpmn" | "pid")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bpmn">BPMN Diagram</TabsTrigger>
                <TabsTrigger value="pid">P&ID Diagram</TabsTrigger>
              </TabsList>
              <TabsContent value="bpmn" className="mt-6 space-y-6">
            <div className="bg-card border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={processing}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold mb-1">
                    {selectedFile ? selectedFile.name : "Drop or record your process video"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Images, PDF, Word documents, text files, or videos
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    MP4/MOV ≤ 200 MB
                  </p>
                </div>
              </label>
              
              {/* Progress Feedback */}
              {processing && uploadProgress > 0 && (
                <div className="mt-6 space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground">{progressText}</p>
                </div>
              )}
              
              {/* Error Display */}
              {errorMessage && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                <ImageFileIcon className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium">Images</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, WEBP</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                <FileText className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium">Documents</span>
                <span className="text-xs text-muted-foreground">PDF, DOC, DOCX</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                <FileText className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium">Text</span>
                <span className="text-xs text-muted-foreground">TXT files</span>
              </div>
            </div>

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setShowUpload(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                  {processing ? "Generating..." : "Generate BPMN"}
                </Button>
              </div>
              </TabsContent>
              <TabsContent value="pid" className="mt-6 space-y-6">
                <div className="bg-card border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload-pid"
                    disabled={processing}
                  />
                  <label htmlFor="file-upload-pid" className="cursor-pointer flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Video className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold mb-1">
                        {selectedFile ? selectedFile.name : "Drop or record your process video"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Images, PDF, Word documents, text files, or videos
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        MP4/MOV ≤ 200 MB
                      </p>
                    </div>
                  </label>
                  
                  {/* Progress Feedback */}
                  {processing && uploadProgress > 0 && (
                    <div className="mt-6 space-y-2">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground">{progressText}</p>
                    </div>
                  )}
                  
                  {/* Error Display */}
                  {errorMessage && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive">{errorMessage}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                    <ImageFileIcon className="w-8 h-8 text-primary" />
                    <span className="text-sm font-medium">Images</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG, WEBP</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                    <FileText className="w-8 h-8 text-primary" />
                    <span className="text-sm font-medium">Documents</span>
                    <span className="text-xs text-muted-foreground">PDF, DOC, DOCX</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
                    <FileText className="w-8 h-8 text-primary" />
                    <span className="text-sm font-medium">Text</span>
                    <span className="text-xs text-muted-foreground">TXT files</span>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setShowUpload(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || processing}>
                    {processing ? "Generating..." : "Generate P&ID"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisionAI;
