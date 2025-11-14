import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@prossmind/shared/config";
import { Button } from "@prossmind/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { FileText, Factory, FolderOpen, LayoutTemplate, Settings, User as UserIcon, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-3 text-foreground">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Get started by creating a new diagram or exploring templates.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-square"
          >
          <Card 
            className="card-hover cursor-pointer group border-border/50 hover:border-primary/60 bg-card/60 dark:bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md hover:shadow-[0_0_20px_rgba(100,180,255,0.4)] relative overflow-hidden transition-all duration-300"
            onClick={() => navigate("/bpmn-generator")}
          >
            <CardHeader className="flex-shrink-0">
              <motion.div 
                className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 tech-glow"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <FileText className="h-7 w-7 text-primary" />
              </motion.div>
              <CardTitle className="text-2xl mb-2">BPMN Generator</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Create business process diagrams
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end mt-auto pt-4">
              <Button className="w-full text-base py-6 min-h-[56px] hover:scale-[1.03] active:scale-[0.98] transition-all" size="lg">
                Create BPMN Diagram
              </Button>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-square"
          >
          <Card 
            className="card-hover cursor-pointer group border-border/50 hover:border-primary/60 bg-card/60 dark:bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md hover:shadow-[0_0_20px_rgba(100,180,255,0.4)] relative overflow-hidden transition-all duration-300"
            onClick={() => navigate("/pid-generator")}
          >
            <CardHeader className="flex-shrink-0">
              <motion.div 
                className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 tech-glow"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <Factory className="h-7 w-7 text-primary" />
              </motion.div>
              <CardTitle className="text-2xl mb-2">P&ID Generator</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Create piping and instrumentation diagrams
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end mt-auto pt-4">
              <Button className="w-full text-base py-6 min-h-[56px] hover:scale-[1.03] active:scale-[0.98] transition-all" size="lg">
                Create P&ID Diagram
              </Button>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-square"
          >
          <Card 
            className="card-hover cursor-pointer group border-border/50 hover:border-primary/60 bg-card/60 dark:bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md hover:shadow-[0_0_20px_rgba(100,180,255,0.4)] relative overflow-hidden transition-all duration-300"
            onClick={() => navigate("/projects")}
          >
            <CardHeader className="flex-shrink-0">
              <motion.div 
                className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <FolderOpen className="h-7 w-7 text-primary" />
              </motion.div>
              <CardTitle className="text-2xl mb-2">Projects</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                View and manage your projects
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end mt-auto pt-4">
              <Button variant="outline" className="w-full text-base py-6 min-h-[56px] hover:scale-[1.03] active:scale-[0.98] transition-all" size="lg">
                View Projects
              </Button>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-square"
          >
          <Card 
            className="card-hover cursor-pointer group border-border/50 hover:border-primary/60 bg-card/60 dark:bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md hover:shadow-[0_0_20px_rgba(100,180,255,0.4)] relative overflow-hidden transition-all duration-300"
            onClick={() => navigate("/templates")}
          >
            <CardHeader className="flex-shrink-0">
              <motion.div 
                className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <LayoutTemplate className="h-7 w-7 text-primary" />
              </motion.div>
              <CardTitle className="text-2xl mb-2">Templates</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Browse process templates
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end mt-auto pt-4">
              <Button variant="outline" className="w-full text-base py-6 min-h-[56px] hover:scale-[1.03] active:scale-[0.98] transition-all" size="lg">
                Browse Templates
              </Button>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-square"
          >
          <Card 
            className="card-hover cursor-pointer group border-border/50 hover:border-primary/60 bg-card/60 dark:bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md hover:shadow-[0_0_20px_rgba(100,180,255,0.4)] relative overflow-hidden transition-all duration-300"
            onClick={() => navigate("/account")}
          >
            <CardHeader className="flex-shrink-0">
              <motion.div 
                className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <UserIcon className="h-7 w-7 text-primary" />
              </motion.div>
              <CardTitle className="text-2xl mb-2">Account</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Manage your account settings
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end mt-auto pt-4">
              <Button variant="outline" className="w-full text-base py-6 min-h-[56px] hover:scale-[1.03] active:scale-[0.98] transition-all" size="lg">
                Account Settings
              </Button>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-square"
          >
          <Card 
            className="card-hover cursor-pointer group border-border/50 hover:border-primary/60 bg-card/60 dark:bg-card/50 backdrop-blur-sm flex flex-col h-full rounded-2xl shadow-md hover:shadow-[0_0_20px_rgba(100,180,255,0.4)] relative overflow-hidden transition-all duration-300"
            onClick={() => navigate("/settings")}
          >
            <CardHeader className="flex-shrink-0">
              <motion.div 
                className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <Settings className="h-7 w-7 text-primary" />
              </motion.div>
              <CardTitle className="text-2xl mb-2">Settings</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Configure application settings
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-end mt-auto pt-4">
              <Button variant="outline" className="w-full text-base py-6 min-h-[56px] hover:scale-[1.03] active:scale-[0.98] transition-all" size="lg">
                App Settings
              </Button>
            </CardContent>
          </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

