import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Brain, Target, Clock, Trophy, BarChart3, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    totalTimeSpent: 0,
    averageScore: 0,
    completedResources: 0
  });
  const [topicMastery, setTopicMastery] = useState<Record<string, unknown>[]>([]);
  // Mock chart data for demonstration, normally derived from user_question_attempts over time
  const activityData = [
    { name: 'Mon', attempts: 4 },
    { name: 'Tue', attempts: 3 },
    { name: 'Wed', attempts: 7 },
    { name: 'Thu', attempts: 5 },
    { name: 'Fri', attempts: 8 },
    { name: 'Sat', attempts: 12 },
    { name: 'Sun', attempts: 15 },
  ];

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);

    // In a real app we fetch for the specific authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Handle unauthenticated state in production

    try {
      const { data: analyticsData } = await supabase
        .from('user_resource_analytics')
        .select('*')
        .eq('user_id', user.id);

      const { data: masteryData } = await supabase
        .from('user_topic_mastery')
        .select('*')
        .eq('user_id', user.id)
        .order('mastery_level', { ascending: false });

      if (analyticsData && analyticsData.length > 0) {
        const totals = analyticsData.reduce((acc, curr) => ({
          totalAttempts: acc.totalAttempts + (curr.total_attempts || 0),
          totalTimeSpent: acc.totalTimeSpent + (curr.total_time_spent || 0),
          completedResources: acc.completedResources + (curr.completed_attempts || 0),
          scoreSum: acc.scoreSum + ((curr.average_score || 0) * (curr.total_attempts || 0))
        }), { totalAttempts: 0, totalTimeSpent: 0, completedResources: 0, scoreSum: 0 });

        setStats({
          totalAttempts: totals.totalAttempts,
          totalTimeSpent: Math.round(totals.totalTimeSpent / 60), // minutes
          averageScore: totals.totalAttempts ? Math.round(totals.scoreSum / totals.totalAttempts) : 0,
          completedResources: totals.completedResources
        });
      }

      setTopicMastery(masteryData || [
          // Mock data if empty for demo purposes
          { topic: 'Calculus', mastery_level: 0.85, attempts_count: 42 },
          { topic: 'Kinematics', mastery_level: 0.72, attempts_count: 28 },
          { topic: 'Number Theory', mastery_level: 0.45, attempts_count: 15 },
          { topic: 'Thermodynamics', mastery_level: 0.60, attempts_count: 20 },
      ]);

    } catch (error) {
      console.error("Error fetching analytics:", error);
    }

    setLoading(false);
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track your progress, analyze your weaknesses, and achieve structural understanding.
        </p>
      </div>

      {loading ? (
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{stats.totalAttempts}</div>
                    <p className="text-sm text-muted-foreground">Total Questions Attempted</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-orange-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{stats.averageScore}%</div>
                    <p className="text-sm text-muted-foreground">Average Accuracy</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{stats.totalTimeSpent}m</div>
                    <p className="text-sm text-muted-foreground">Time Spent Practicing</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Brain className="w-5 h-5 text-green-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{stats.completedResources}</div>
                    <p className="text-sm text-muted-foreground">Full Papers Completed</p>
                </CardContent>
            </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Activity Overview
                </CardTitle>
                <CardDescription>Your practice volume over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activityData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.5}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.5}} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Line type="monotone" dataKey="attempts" stroke="var(--primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--primary)', strokeWidth: 2}} activeDot={{r: 6}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Topic Mastery</CardTitle>
                <CardDescription>AI-estimated structural understanding</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {topicMastery.map((topic, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{topic.topic as string}</span>
                                <span className="text-muted-foreground">{Math.round((topic.mastery_level as number) * 100)}%</span>
                            </div>
                            <Progress value={(topic.mastery_level as number) * 100} className="h-2" />
                            <p className="text-xs text-muted-foreground">{topic.attempts_count as number} questions attempted</p>
                        </div>
                    ))}
                </div>
                <button className="w-full mt-6 flex items-center justify-center gap-1 text-sm text-primary font-medium hover:underline">
                    View detailed breakdown <ChevronRight className="w-4 h-4" />
                </button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
