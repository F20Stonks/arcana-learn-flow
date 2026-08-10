import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Globe, Search, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ResourceBank() {
  const [resources, setResources] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchResources();
  }, []);

  async function fetchResources() {
    setLoading(true);
    // Since we just added columns in a migration, they might be null for older rows, but we fetch all.
    const { data, error } = await supabase
      .from('reference_questions')
      .select('id, source_competition, year, subject, difficulty, language, source_country, resource_type, learning_track, full_pdf_storage_path')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching resources:', error);
    } else {
      setResources(data || []);
    }
    setLoading(false);
  }

  const filteredResources = resources.filter(res => {
    const sourceComp = typeof res.source_competition === 'string' ? res.source_competition : '';
    const subject = typeof res.subject === 'string' ? res.subject : '';
    const matchesSearch = sourceComp.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrack = selectedTrack === 'all' || res.learning_track === selectedTrack;
    const matchesType = selectedType === 'all' || res.resource_type === selectedType;
    return matchesSearch && matchesTrack && matchesType;
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Resource Bank</h1>
          <p className="text-muted-foreground mt-2">
            Access past papers, mocks, and Olympiad resources from around the world.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-card p-4 rounded-xl border">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competitions or subjects..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={selectedTrack} onValueChange={setSelectedTrack}>
          <SelectTrigger>
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Tracks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tracks</SelectItem>
            <SelectItem value="ESAT">ESAT / NSAA</SelectItem>
            <SelectItem value="TMUA">TMUA</SelectItem>
            <SelectItem value="A-Level">A-Level</SelectItem>
            <SelectItem value="Olympiad">Olympiads (BMO/Putnam)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger>
            <BookOpen className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Resource Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="past_paper">Past Papers</SelectItem>
            <SelectItem value="mock">Mocks</SelectItem>
            <SelectItem value="handout">Handouts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No resources found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            Try adjusting your filters or check back later as we continuously index new materials.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((res) => (
            <Card key={res.id} className="flex flex-col hover:border-primary/50 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={res.difficulty === 'hard' ? 'destructive' : res.difficulty === 'medium' ? 'default' : 'secondary'}>
                    {(res.difficulty as string) || 'Unrated'}
                  </Badge>
                  {res.language && res.language !== 'English' && (
                    <Badge variant="outline" className="flex items-center gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
                      <Globe className="w-3 h-3" />
                      {res.language as string}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {res.source_competition as string} {res.year ? `(${res.year})` : ''}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span className="font-medium text-foreground">{res.subject as string}</span>
                  {res.source_country && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{res.source_country as string}</span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground capitalize">
                    {typeof res.resource_type === 'string' ? res.resource_type.replace('_', ' ') : 'Resource'}
                  </span>
                  <div className="flex gap-2">
                    {res.full_pdf_storage_path && (
                      <Button variant="outline" size="sm" onClick={() => window.open(`${supabase.storage.from('reference-papers').getPublicUrl(res.full_pdf_storage_path as string).data.publicUrl}`, '_blank')}>
                        <FileText className="w-4 h-4 mr-2" />
                        PDF
                      </Button>
                    )}
                    <Button size="sm" onClick={() => window.location.href = `/reference-questions?competition=${res.source_competition}`}>
                      Practice
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
