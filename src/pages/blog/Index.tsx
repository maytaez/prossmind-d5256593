import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

const BlogIndex = () => {
  const articles = [
    {
      id: 1,
      title: "Getting Started with BPMN Diagrams",
      excerpt: "Learn how to create your first business process model using ProssMind",
      date: "2024-01-15",
      readTime: "5 min",
      category: "Tutorial",
    },
    {
      id: 2,
      title: "Best Practices for Process Automation",
      excerpt: "Discover industry best practices for automating business processes",
      date: "2024-01-10",
      readTime: "8 min",
      category: "Guide",
    },
    {
      id: 3,
      title: "Vision AI: Converting Handwritten Notes to Diagrams",
      excerpt: "See how Vision AI transforms handwritten process sketches into professional diagrams",
      date: "2024-01-05",
      readTime: "6 min",
      category: "Feature",
    },
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground">
            Insights, tutorials, and updates from the ProssMind team
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Card key={article.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                    {article.category}
                  </span>
                </div>
                <CardTitle>{article.title}</CardTitle>
                <CardDescription>{article.excerpt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(article.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {article.readTime}
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  Read More
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContainer>
    </div>
  );
};

export default BlogIndex;



