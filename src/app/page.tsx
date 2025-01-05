import { Chat } from '../components/Chat';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-gray-800">
            Crustdata API Support
          </h1>
          <p className="mx-auto max-w-[700px] text-gray-600">
            Get instant help with Crustdata APIs. Ask any technical questions about our services.
          </p>
        </div>
        <Chat />
      </div>
    </main>
  );
}
