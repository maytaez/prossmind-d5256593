import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { featureFlags } from "@/config/featureFlags";

const teamMembers = [
  {
    name: "Mayank Sharma",
    role: "CEO & Founder",
    description: "Finance and digital transformation leader driving data-powered, innovative tech solutions.",
    image: "/mayank.png",
    initials: "MS"
  },
  {
    name: "Satyam Pant",
    role: "Cofounder & AI Solutions",
    description: "Tech innovator specializing in AI-driven business process solutions.",
    image: "/satyam.jpeg",
    initials: "SP"
  },
  {
    name: "Divyam Pant",
    role: "CTO & Head of Product",
    description: "Product strategist focused on creating intuitive workflow automation tools.",
    image: "/divyam.jpeg",
    initials: "DP"
  },
  {
    name: "Sahil Pandey",
    role: "DevOps Engineer",
    description: "Full-stack engineer passionate about building scalable BPMN solutions.",
    image: "/sahil.jpeg",
    initials: "SP"
  }
];

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-24 pb-20">
        <PageContainer>
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">
              Get in{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Touch</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-card border border-border rounded-xl p-6 text-center transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-blue-500/50 hover:scale-[1.02] hover:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-all duration-300">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Email Us</h3>
              <p className="text-sm text-muted-foreground">info@prossmind.com</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 text-center transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-blue-500/50 hover:scale-[1.02] hover:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-all duration-300">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Call Us</h3>
              <p className="text-sm text-muted-foreground">+41 78 330 79 67</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 text-center transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-blue-500/50 hover:scale-[1.02] hover:-translate-y-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-all duration-300">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Available 24/7</p>
            </div>
          </div>

          {featureFlags.showTeamSection && (
            <div className="mb-16">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4">
                  Meet Our{" "}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Team</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  The passionate people behind ProssMind
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {teamMembers.map((member) => (
                  <Card key={member.name} className="text-center transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-blue-500/50 hover:scale-[1.03] hover:-translate-y-2">
                    <CardContent className="pt-6 pb-6">
                      <Avatar className="w-24 h-24 mx-auto mb-4 transition-all duration-300">
                        <AvatarImage src={member.image} alt={member.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold text-lg mb-1">{member.name}</h3>
                      <p className="text-sm text-primary mb-3">{member.role}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {member.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-blue-500/30">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    className="transition-all duration-300 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)] focus:shadow-blue-500/40"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="transition-all duration-300 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)] focus:shadow-blue-500/40"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium">
                  Subject
                </label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="How can we help?"
                  className="transition-all duration-300 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)] focus:shadow-blue-500/40"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us more about your inquiry..."
                  className="min-h-[150px] transition-all duration-300 focus:shadow-[0_0_15px_rgba(59,130,246,0.4)] focus:shadow-blue-500/40"
                  required
                />
              </div>

              <Button type="submit" size="lg" className="w-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] hover:shadow-blue-500/60 hover:scale-[1.02]">
                Send Message
              </Button>
            </form>
          </div>
        </PageContainer>
      </main>
    </div>
  );
};

export default Contact;
