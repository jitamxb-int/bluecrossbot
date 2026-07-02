import UploadLayout from '../components/layout/UploadLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import FileUploader from '../components/upload/FileUploader';
import PdfUploader from '../components/upload/PdfUploader';

const UploadPage = () => {
  return (
    <UploadLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload Documents</h1>
          <p className="text-muted-foreground">
            Ingest source content into the knowledge base. Select one or more .txt files per upload.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ingestion</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="descriptive">
              <TabsList className="grid w-full grid-cols-4 max-w-xl">
                <TabsTrigger value="descriptive">Descriptive</TabsTrigger>
                <TabsTrigger value="pdf">PDF</TabsTrigger>
                <TabsTrigger value="product">Product</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
              </TabsList>

              <TabsContent value="descriptive" className="mt-6">
                <FileUploader
                  kind="descriptive"
                  description="Website / document .txt files (with a URL header). Content is chunked, embedded, and stored as descriptive vectors."
                />
              </TabsContent>

              <TabsContent value="pdf" className="mt-6">
                <PdfUploader />
              </TabsContent>

              <TabsContent value="product" className="mt-6">
                <FileUploader
                  kind="product"
                  description="Structured product JSON .txt files. Each product record is stored as a single vector (no chunking)."
                />
              </TabsContent>

              <TabsContent value="video" className="mt-6">
                <FileUploader
                  kind="video"
                  description="Structured video JSON .txt files. Each video record is stored as a single vector (no chunking)."
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </UploadLayout>
  );
};

export default UploadPage;
