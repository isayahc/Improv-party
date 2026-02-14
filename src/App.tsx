import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { APITester } from "./APITester";
import "./index.css";
import { BottomNav } from "./components/bottomNavigation";
// import { VoiceTest}
// import { VoiceRecorder } from "./components/voiceTest";
// import { VoiceRoom } from "./components/VoiceStation";
import { TurnBasedRecorder } from "./components/TurnBasedRecorder";

import logo from "./logo.svg";
import reactLogo from "./react.svg";

// export function App() {
//   return (
//     <div className="container mx-auto p-8 text-center relative z-10">
//       <div className="flex justify-center items-center gap-8 mb-8">
//         <img
//           src={logo}
//           alt="Bun Logo"
//           className="h-36 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#646cffaa] scale-120"
//         />
//         <img
//           src={reactLogo}
//           alt="React Logo"
//           className="h-36 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] [animation:spin_20s_linear_infinite]"
//         />
//       </div>
//       <Card>
//         <CardHeader className="gap-4">
//           <CardTitle className="text-3xl font-bold">Bun + React</CardTitle>
//           <CardDescription>
//             Edit <code className="rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono">src/App.tsx</code> and save to
//             test HMR
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           <APITester />
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

// export function App() {
//   return (
//     <div>
//       <header>
//         {/* This shows if the user is NOT logged in */}
//         <SignedOut>
//           <h1>Please sign in to continue</h1>
//           <SignInButton mode="modal" />
//         </SignedOut>

//         {/* This shows if the user IS logged in */}
//         <SignedIn>
//           <TurnBasedRecorder></TurnBasedRecorder>
//           <BottomNav></BottomNav>
//           <UserButton />
//         </SignedIn>
//       </header>
//       <main>

//       </main>
//     </div>
//   );
// }

export function App() {
  return (
    <div>
      <header>
        <TurnBasedRecorder></TurnBasedRecorder>
        <BottomNav></BottomNav>
      </header>
      <main></main>
    </div>
  );
}

export default App;
