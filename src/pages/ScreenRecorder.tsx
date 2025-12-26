import { useState, useRef, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Video, Play, Square, Pause, Upload as UploadIcon, FileVideo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BpmnViewerComponent from "@/components/BpmnViewer";

const ScreenRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const timeIntervalRef = useRef<number | null>(null);

  // Subscribe to job status updates with polling fallback
  useEffect(() => {
    if (!currentJobId) return;

    // eslint-disable-next-line prefer-const
    let pollInterval: number | undefined;
    const checkJobStatus = async () => {
      const { data, error } = await supabase
        .from('screen_recording_jobs')
        .select('status, bpmn_xml, error_message')
        .eq('id', currentJobId)
        .single();

      if (error) {
        console.error('Error checking job status:', error);
        return;
      }

      console.log('Job status:', data.status);

      if (data.status === 'completed' && data.bpmn_xml) {
        console.log('✓ BPMN XML received, length:', data.bpmn_xml.length);
        setBpmnXml(data.bpmn_xml);
        
        toast.success("BPMN diagram generated successfully!", {
          description: "Your screen recording workflow has been converted to a BPMN diagram"
        });
        
        setProcessing(false);
        setCurrentJobId(null);
        if (pollInterval) clearInterval(pollInterval);
      } else if (data.status === 'failed') {
        console.error('✗ Job failed:', data.error_message);
        toast.error("Failed to generate BPMN diagram", {
          description: data.error_message || "Please try again"
        });
        setProcessing(false);
        setCurrentJobId(null);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    // Try realtime subscription first
    const channel = supabase
      .channel(`screen-job-${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screen_recording_jobs',
          filter: `id=eq.${currentJobId}`
        },
        (payload) => {
          const job = payload.new as { status: string; bpmn_xml?: string; error_message?: string };
          console.log('📡 Realtime job status update:', job.status);

          if (job.status === 'completed' && job.bpmn_xml) {
            console.log('✓ BPMN XML received via realtime, length:', job.bpmn_xml.length);
            setBpmnXml(job.bpmn_xml);
            
            toast.success("BPMN diagram generated successfully!", {
              description: "Your screen recording workflow has been converted to a BPMN diagram"
            });
            
            setProcessing(false);
            setCurrentJobId(null);
            if (pollInterval) clearInterval(pollInterval);
          } else if (job.status === 'failed') {
            toast.error("Failed to generate BPMN diagram", {
              description: job.error_message || "Please try again"
            });
            setProcessing(false);
            setCurrentJobId(null);
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
      toast.error("Processing timed out", {
        description: "Please try again or contact support"
      });
      setProcessing(false);
      setCurrentJobId(null);
    }, 300000); // 5 minutes
    
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJobId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 5 }
        } as MediaTrackConstraints,
        audio: false
      });

      streamRef.current = stream;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast.error("Recording error occurred");
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      
      // Start timer
      setRecordingTime(0);
      const MAX_RECORDING_TIME = 30; // 30 seconds max
      
      timeIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          // Warn at 25 seconds
          if (newTime === 25) {
            toast.warning("Recording will stop in 5 seconds", {
              description: "Maximum recording length is 30 seconds"
            });
          }
          
          // Auto-stop at 30 seconds
          if (newTime >= MAX_RECORDING_TIME) {
            if (timeIntervalRef.current) {
              clearInterval(timeIntervalRef.current);
            }
            stopRecording();
            return prev;
          }
          
          return newTime;
        });
      }, 1000);

      toast.success("Recording started", {
        description: "Maximum recording length: 30 seconds"
      });

      // Handle user stopping the share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording();
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Failed to start recording", {
        description: error instanceof Error ? error.message : "Please check your browser permissions"
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
      toast.info("Recording paused");
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timeIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      toast.info("Recording resumed");
    }
  };

  const extractFramesFromVideo = async (videoBlob: Blob): Promise<string[]> => {
    console.log('Starting frame extraction via Cloudinary...');
    
    try {
      const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      
      if (!cloudinaryCloudName) {
        console.log('No Cloudinary configured, skipping frame extraction');
        return [];
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(videoBlob);
      });
      
      const videoBase64 = await base64Promise;
      
      // Upload to Cloudinary and request frame extraction
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/video/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: videoBase64,
            folder: 'screen-recordings',
            eager: [
              // Extract frames at different timestamps (every 5 seconds up to 25s)
              { format: 'jpg', transformation: [{ duration: 5 }] },
              { format: 'jpg', transformation: [{ duration: 10 }] },
              { format: 'jpg', transformation: [{ duration: 15 }] },
              { format: 'jpg', transformation: [{ duration: 20 }] },
              { format: 'jpg', transformation: [{ duration: 25 }] },
            ],
            eager_async: false,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.eager && result.eager.length > 0) {
        // Download extracted frames
        const frames: string[] = [];
        for (const frame of result.eager) {
          const frameResponse = await fetch(frame.secure_url);
          const frameBlob = await frameResponse.blob();
          const frameBase64 = await new Promise<string>((resolve) => {
            const frameReader = new FileReader();
            frameReader.onload = () => resolve(frameReader.result as string);
            frameReader.readAsDataURL(frameBlob);
          });
          frames.push(frameBase64);
        }
        
        console.log(`Successfully extracted ${frames.length} frames from Cloudinary`);
        return frames;
      }
      
      console.log('No frames extracted from Cloudinary');
      return [];
      
    } catch (error) {
      console.error('Cloudinary frame extraction failed:', error);
      return []; // Fallback to simulated frames
    }
  };
  

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    // Stop screen share
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop timer
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    
    toast.info("Processing your recording...");
    
    // Create blob from recorded chunks
    const recordedBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    
    console.log('Video blob size:', recordedBlob.size, 'bytes');
    
    toast.info("Extracting frames from video...");
    
    // Extract frames from video
    const frames = await extractFramesFromVideo(recordedBlob);
    
    if (frames.length > 0) {
      console.log(`Successfully extracted ${frames.length} frames`);
      toast.success(`Extracted ${frames.length} frames from video`);
    } else {
      console.log('No frames extracted, using simulated frames');
      toast.warning('Using simulated frames - recording details may be limited');
    }
    
    // Process the recording with extracted frames
    await processRecording(recordedBlob, frames);
  };

  const processRecording = async (videoBlob: Blob, frames: string[]) => {
    setProcessing(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!user || userError) {
        toast.error("Please log in to use this feature");
        console.error('Auth error:', userError);
        window.location.href = '/auth';
        return;
      }

      console.log('Sending frames to edge function:', frames.length);

      // Call the edge function with extracted frames
      const { invokeFunction } = await import('@/utils/api-client');
      const { data, error } = await invokeFunction('screen-recording-to-bpmn', {
        frames: frames  // Send actual extracted frames
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error(error.message || "Failed to start processing", {
          description: "Please try again"
        });
        setProcessing(false);
        return;
      }

      if (!data || !data.jobId) {
        console.error('No job ID in response:', data);
        toast.error("Failed to start processing", {
          description: "Please try again"
        });
        setProcessing(false);
        return;
      }

      // Set job ID to start listening for updates
      setCurrentJobId(data.jobId);
      console.log('✓ Job started with ID:', data.jobId);
      console.log('✓ Frames sent to processing:', frames.length);
      console.log('✓ Starting polling/realtime subscription...');
      
      toast.info("Processing started", {
        description: "We'll notify you when your diagram is ready (this may take 1-2 minutes)"
      });
    } catch (error) {
      console.error('Processing error:', error);
      toast.error("Failed to process recording", {
        description: error instanceof Error ? error.message : "Please try again"
      });
      setProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <Video className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-5xl font-bold mb-4">
              Screen <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Recorder</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Record your screen workflow and automatically generate a BPMN diagram. Our AI analyzes your navigation and converts it into a professional process diagram.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Recording Controls */}
            <div className="bg-card border border-border rounded-2xl p-8 mb-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Screen Recording</h2>
                  <p className="text-muted-foreground">
                    Record your workflow to generate an automatic BPMN diagram
                  </p>
                </div>

                {/* Recording Stats */}
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{formatTime(recordingTime)}</div>
                    <div className="text-sm text-muted-foreground">
                      Recording Time {isRecording ? `/ ${formatTime(30)}` : ''}
                    </div>
                  </div>
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Recording</span>
                    </div>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center gap-4">
                  {!isRecording && !processing && (
                    <Button 
                      size="lg" 
                      onClick={startRecording}
                      className="gap-2"
                    >
                      <Play className="h-5 w-5" />
                      Start Recording
                    </Button>
                  )}

                  {isRecording && (
                    <>
                      {!isPaused ? (
                        <Button 
                          size="lg" 
                          variant="outline"
                          onClick={pauseRecording}
                          className="gap-2"
                        >
                          <Pause className="h-5 w-5" />
                          Pause
                        </Button>
                      ) : (
                        <Button 
                          size="lg" 
                          variant="outline"
                          onClick={resumeRecording}
                          className="gap-2"
                        >
                          <Play className="h-5 w-5" />
                          Resume
                        </Button>
                      )}
                      <Button 
                        size="lg" 
                        onClick={stopRecording}
                        className="gap-2 bg-red-600 hover:bg-red-700"
                      >
                        <Square className="h-5 w-5" />
                        Stop & Process
                      </Button>
                    </>
                  )}

                  {processing && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Processing...</p>
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                  <h3 className="font-semibold mb-2">How it works:</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Click "Start Recording" and share your screen</li>
                    <li>Navigate through your workflow as you normally would</li>
                    <li>Click "Stop & Process" when finished</li>
                    <li>AI will analyze your recording and generate a BPMN diagram</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* BPMN Viewer */}
            {bpmnXml && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-4">Generated BPMN Diagram</h3>
                <BpmnViewerComponent 
                  xml={bpmnXml}
                  onSave={(updatedXml) => {
                    setBpmnXml(updatedXml);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ScreenRecorder;

