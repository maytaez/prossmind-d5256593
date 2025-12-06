/**
 * Example usage of CombinedCamundaWebModeler component
 * 
 * This file demonstrates various ways to use the combined BPMN + DMN modeler
 * with AI generation capabilities.
 */

import React, { useState } from "react";
import CombinedCamundaWebModeler from "@/components/CombinedCamundaWebModeler";
import "@miragon/camunda-web-modeler/dist/bundle.css";
import { supabase } from "@/integrations/supabase/client";

/**
 * Example 1: Basic Usage
 * Minimal setup with default templates
 */
export function BasicExample() {
  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler />
    </div>
  );
}

/**
 * Example 2: With Change Handlers
 * Track changes to BPMN and DMN diagrams
 */
export function WithChangeHandlers() {
  const [bpmnVersion, setBpmnVersion] = useState(0);
  const [dmnVersion, setDmnVersion] = useState(0);

  const handleBpmnChange = (xml: string) => {
    console.log("BPMN changed:", xml.substring(0, 100));
    setBpmnVersion(prev => prev + 1);
    // Save to backend
    saveBpmnToBackend(xml);
  };

  const handleDmnChange = (xml: string) => {
    console.log("DMN changed:", xml.substring(0, 100));
    setDmnVersion(prev => prev + 1);
    // Save to backend
    saveDmnToBackend(xml);
  };

  const saveBpmnToBackend = async (xml: string) => {
    // Example: Save to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('bpmn_diagrams').upsert({
      user_id: user.id,
      xml_content: xml,
      updated_at: new Date().toISOString()
    });
  };

  const saveDmnToBackend = async (xml: string) => {
    // Example: Save to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('dmn_diagrams').upsert({
      user_id: user.id,
      xml_content: xml,
      updated_at: new Date().toISOString()
    });
  };

  return (
    <div className="h-screen w-full">
      <div className="bg-muted p-2 text-sm text-center">
        BPMN Version: {bpmnVersion} | DMN Version: {dmnVersion}
      </div>
      <CombinedCamundaWebModeler
        onBpmnChange={handleBpmnChange}
        onDmnChange={handleDmnChange}
      />
    </div>
  );
}

/**
 * Example 3: Loading Existing Diagrams
 * Initialize with previously saved diagrams
 */
export function WithExistingDiagrams() {
  const [bpmnXml, setBpmnXml] = useState<string | undefined>();
  const [dmnXml, setDmnXml] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    loadDiagrams();
  }, []);

  const loadDiagrams = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Load BPMN
    const { data: bpmnData } = await supabase
      .from('bpmn_diagrams')
      .select('xml_content')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (bpmnData) {
      setBpmnXml(bpmnData.xml_content);
    }

    // Load DMN
    const { data: dmnData } = await supabase
      .from('dmn_diagrams')
      .select('xml_content')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (dmnData) {
      setDmnXml(dmnData.xml_content);
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading diagrams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        initialBpmnXml={bpmnXml}
        initialDmnXml={dmnXml}
        onBpmnChange={(xml) => console.log("BPMN updated")}
        onDmnChange={(xml) => console.log("DMN updated")}
      />
    </div>
  );
}

/**
 * Example 4: AI Generation Workflow
 * Programmatic AI generation
 */
export function AIGenerationExample() {
  const [currentXml, setCurrentXml] = useState<string>("");

  const generateFromPrompt = async (prompt: string, type: 'bpmn' | 'dmn') => {
    const { invokeFunction } = await import('@/utils/api-client');
    const functionName = type === 'dmn' ? 'generate-dmn' : 'generate-bpmn';
    
    const { data, error } = await invokeFunction(functionName, {
      prompt,
      diagramType: type === 'dmn' ? undefined : 'bpmn'
    });

    if (error) {
      console.error('Generation error:', error);
      return null;
    }

    const xml = data?.bpmnXml || data?.dmnXml;
    setCurrentXml(xml);
    return xml;
  };

  const handleBpmnChange = (xml: string) => {
    setCurrentXml(xml);
  };

  const handleDmnChange = (xml: string) => {
    setCurrentXml(xml);
  };

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        onBpmnChange={handleBpmnChange}
        onDmnChange={handleDmnChange}
      />
    </div>
  );
}

/**
 * Example 5: Multi-tenant Setup
 * Different diagrams for different organizations
 */
export function MultiTenantExample() {
  const [orgId, setOrgId] = useState<string | null>(null);

  React.useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's organization
    const { data } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setOrgId(data.organization_id);
    }
  };

  const handleBpmnChange = async (xml: string) => {
    if (!orgId) return;

    await supabase.from('org_bpmn_diagrams').upsert({
      organization_id: orgId,
      xml_content: xml,
      updated_at: new Date().toISOString()
    });
  };

  const handleDmnChange = async (xml: string) => {
    if (!orgId) return;

    await supabase.from('org_dmn_diagrams').upsert({
      organization_id: orgId,
      xml_content: xml,
      updated_at: new Date().toISOString()
    });
  };

  if (!orgId) {
    return <div>Loading organization...</div>;
  }

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        onBpmnChange={handleBpmnChange}
        onDmnChange={handleDmnChange}
        userId={orgId}
      />
    </div>
  );
}

/**
 * Example 6: Integration with Camunda/Flowable
 * Deploy diagrams to process engine
 */
export function ProcessEngineIntegration() {
  const deployToCamunda = async (xml: string, type: 'bpmn' | 'dmn') => {
    // Example deployment to Camunda REST API
    const endpoint = type === 'bpmn' 
      ? 'http://localhost:8080/engine-rest/deployment/create'
      : 'http://localhost:8080/engine-rest/deployment/create';

    const formData = new FormData();
    const blob = new Blob([xml], { type: 'application/xml' });
    formData.append('deployment-name', `${type}-deployment-${Date.now()}`);
    formData.append('deployment-source', 'prossmind');
    formData.append(`diagram.${type}`, blob, `diagram.${type}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        console.log(`${type.toUpperCase()} deployed successfully`);
        return await response.json();
      }
    } catch (error) {
      console.error('Deployment error:', error);
    }
  };

  const handleBpmnChange = (xml: string) => {
    console.log("BPMN updated - ready to deploy");
    // Auto-deploy or show deploy button
  };

  const handleDmnChange = (xml: string) => {
    console.log("DMN updated - ready to deploy");
    // Auto-deploy or show deploy button
  };

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        onBpmnChange={handleBpmnChange}
        onDmnChange={handleDmnChange}
      />
    </div>
  );
}

export default BasicExample;
