import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function UiDemoPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>shadcn/ui 示例</CardTitle>
          <CardDescription>
            这里用来确认 Button 和 Card 已经装好，可以在新页面里直接用。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>现有首页没有改动。打开这个地址只是为了看一眼组件样式。</p>
        </CardContent>
        <CardFooter>
          <Button type="button">知道了</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
