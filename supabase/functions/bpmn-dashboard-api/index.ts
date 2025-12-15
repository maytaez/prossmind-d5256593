import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueryParams {
    page?: string;
    limit?: string;
    status?: string;
    userId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    diagramType?: string;
    sourceFunction?: string;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const path = url.pathname.replace("/bpmn-dashboard-api", "");

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Supabase configuration missing");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Route handling
        if (path === "/metrics/overview" && req.method === "GET") {
            return await getMetricsOverview(supabase);
        }

        if (path === "/requests" && req.method === "GET") {
            const params = Object.fromEntries(url.searchParams.entries()) as QueryParams;
            return await getRequests(supabase, params);
        }

        if (path.startsWith("/requests/") && req.method === "GET") {
            const logId = path.split("/")[2];
            return await getRequestDetail(supabase, logId);
        }

        if (path === "/analytics/daily" && req.method === "GET") {
            return await getDailyStats(supabase);
        }

        if (path === "/analytics/cost" && req.method === "GET") {
            return await getCostAnalysis(supabase);
        }

        if (path === "/analytics/cache" && req.method === "GET") {
            return await getCachePerformance(supabase);
        }

        if (path === "/analytics/errors" && req.method === "GET") {
            return await getErrorSummary(supabase);
        }

        if (path === "/export" && req.method === "POST") {
            const params = await req.json();
            return await exportData(supabase, params);
        }

        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("[Dashboard API] Error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});

// Get metrics overview (KPIs)
async function getMetricsOverview(supabase: any) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total requests and success rate
    const { data: totalStats, error: totalError } = await supabase
        .from("bpmn_generation_logs")
        .select("status, cache_hit, estimated_cost_usd")
        .gte("request_timestamp", thirtyDaysAgo.toISOString());

    if (totalError) throw totalError;

    const totalRequests = totalStats?.length || 0;
    const successfulRequests = totalStats?.filter((r: any) => r.status === "success" || r.status === "cached").length || 0;
    const cacheHits = totalStats?.filter((r: any) => r.cache_hit === true).length || 0;
    const totalCost = totalStats?.reduce((sum: number, r: any) => sum + (r.estimated_cost_usd || 0), 0) || 0;

    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

    // Get average duration
    const { data: avgData, error: avgError } = await supabase
        .from("bpmn_generation_logs")
        .select("generation_duration_ms")
        .gte("request_timestamp", thirtyDaysAgo.toISOString())
        .not("generation_duration_ms", "is", null);

    if (avgError) throw avgError;

    const avgDuration = avgData && avgData.length > 0
        ? avgData.reduce((sum: number, r: any) => sum + r.generation_duration_ms, 0) / avgData.length
        : 0;

    // Get recent error count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentErrors, error: errorsError } = await supabase
        .from("bpmn_generation_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "error")
        .gte("request_timestamp", sevenDaysAgo.toISOString());

    if (errorsError) throw errorsError;

    return new Response(
        JSON.stringify({
            totalRequests,
            successRate: Math.round(successRate * 10) / 10,
            cacheHitRate: Math.round(cacheHitRate * 10) / 10,
            avgDurationMs: Math.round(avgDuration),
            totalCostUsd: Math.round(totalCost * 1000000) / 1000000,
            recentErrors: recentErrors || 0,
        }),
        {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
    );
}

// Get paginated requests with filters
async function getRequests(supabase: any, params: QueryParams) {
    const page = parseInt(params.page || "1");
    const limit = parseInt(params.limit || "50");
    const offset = (page - 1) * limit;

    let query = supabase
        .from("bpmn_generation_logs")
        .select("*", { count: "exact" })
        .neq("status", "pending") // Exclude incomplete/pending requests
        .order("request_timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

    // Apply filters
    if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
    }

    if (params.userId) {
        query = query.eq("user_id", params.userId);
    }

    if (params.diagramType) {
        query = query.eq("diagram_type", params.diagramType);
    }

    if (params.sourceFunction) {
        query = query.eq("source_function", params.sourceFunction);
    }

    if (params.dateFrom) {
        query = query.gte("request_timestamp", params.dateFrom);
    }

    if (params.dateTo) {
        query = query.lte("request_timestamp", params.dateTo);
    }

    if (params.search) {
        query = query.ilike("original_prompt", `%${params.search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get user emails for the results
    const userIds = [...new Set(data?.map((r: any) => r.user_id) || [])];
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
        console.warn("Failed to fetch user emails:", usersError);
    }

    const userEmailMap = new Map(users?.users?.map((u: any) => [u.id, u.email]) || []);

    // Enrich data with user emails
    const enrichedData = data?.map((r: any) => ({
        ...r,
        user_email: userEmailMap.get(r.user_id) || "Unknown",
    }));

    return new Response(
        JSON.stringify({
            data: enrichedData,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        }),
        {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
    );
}

// Get single request detail
async function getRequestDetail(supabase: any, logId: string) {
    const { data, error } = await supabase
        .from("bpmn_generation_logs")
        .select("*")
        .eq("id", logId)
        .single();

    if (error) throw error;

    if (!data) {
        return new Response(JSON.stringify({ error: "Request not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Get user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.user_id);

    if (!userError && userData) {
        data.user_email = userData.user.email;
    }

    // Get child requests if this is a parent
    if (data.is_multi_diagram) {
        const { data: children, error: childrenError } = await supabase
            .from("bpmn_generation_logs")
            .select("id, original_prompt, status, generation_duration_ms, estimated_cost_usd")
            .eq("parent_request_id", logId)
            .order("created_at", { ascending: true });

        if (!childrenError) {
            data.sub_requests = children;
        }
    }

    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Get daily stats from view
async function getDailyStats(supabase: any) {
    const { data, error } = await supabase
        .from("dashboard_daily_stats")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Get cost analysis from view
async function getCostAnalysis(supabase: any) {
    const { data, error } = await supabase
        .from("dashboard_cost_analysis")
        .select("*")
        .order("total_cost", { ascending: false })
        .limit(100);

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Get cache performance from view
async function getCachePerformance(supabase: any) {
    const { data, error } = await supabase
        .from("dashboard_cache_performance")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Get error summary from view
async function getErrorSummary(supabase: any) {
    const { data, error } = await supabase
        .from("dashboard_error_summary")
        .select("*")
        .limit(50);

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Export data as CSV
async function exportData(supabase: any, params: any) {
    const { format = "csv", filters = {} } = params;

    // Fetch data with same filters as regular requests
    let query = supabase
        .from("bpmn_generation_logs")
        .select("*")
        .order("request_timestamp", { ascending: false })
        .limit(10000); // Max 10k rows for export

    // Apply filters (same logic as getRequests)
    if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
    }
    if (filters.userId) {
        query = query.eq("user_id", filters.userId);
    }
    if (filters.diagramType) {
        query = query.eq("diagram_type", filters.diagramType);
    }
    if (filters.dateFrom) {
        query = query.gte("request_timestamp", filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte("request_timestamp", filters.dateTo);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (format === "csv") {
        const csv = generateCSV(data || []);
        return new Response(csv, {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="bpmn-dashboard-export-${Date.now()}.csv"`,
            },
        });
    }

    // For Excel format, return JSON (frontend will handle with xlsx library)
    return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Generate CSV from data
function generateCSV(data: any[]): string {
    if (data.length === 0) return "";

    const headers = [
        "Timestamp",
        "User ID",
        "Prompt",
        "Diagram Type",
        "Status",
        "Duration (ms)",
        "Cache Hit",
        "Input Tokens",
        "Output Tokens",
        "Cost (USD)",
        "Source Function",
        "Result XML",
        "Error Message",
    ];

    const rows = data.map((row) => [
        row.request_timestamp,
        row.user_id,
        `"${(row.original_prompt || "").replace(/"/g, '""').substring(0, 200)}"`,
        row.diagram_type,
        row.status,
        row.generation_duration_ms || "",
        row.cache_hit ? "Yes" : "No",
        row.input_tokens || "",
        row.output_tokens || "",
        row.estimated_cost_usd || "",
        row.source_function,
        `"${(row.result_xml || "").replace(/"/g, '""')}"`,
        `"${(row.error_message || "").replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
