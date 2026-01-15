import 'lucide-react-native';
import { ViewStyle } from 'react-native';

declare module 'lucide-react-native' {
  import { SvgProps } from 'react-native-svg';

  export interface LucideProps extends SvgProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
    fill?: string;
    style?: ViewStyle;
  }

  export type LucideIcon = React.FC<LucideProps>;

  // Re-export all icons with correct types
  export const Home: LucideIcon;
  export const Layout: LucideIcon;
  export const User: LucideIcon;
  export const Plus: LucideIcon;
  export const FileText: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const Star: LucideIcon;
  export const Lock: LucideIcon;
  export const Moon: LucideIcon;
  export const Bell: LucideIcon;
  export const Shield: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const LogOut: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Crown: LucideIcon;
  export const Vibrate: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Download: LucideIcon;
  export const Sparkles: LucideIcon;
  export const GripVertical: LucideIcon;
  export const Briefcase: LucideIcon;
  export const GraduationCap: LucideIcon;
  export const Code: LucideIcon;
  export const Folder: LucideIcon;
  export const Award: LucideIcon;
  export const Languages: LucideIcon;
  export const Trophy: LucideIcon;
  export const Trash2: LucideIcon;
  export const Share2: LucideIcon;
  export const Check: LucideIcon;
  export const Mail: LucideIcon;
  export const KeyRound: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Loader2: LucideIcon;
  export const X: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const Target: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Linkedin: LucideIcon;
  export const Menu: LucideIcon;
  export const Key: LucideIcon;
  export const Zap: LucideIcon;
  export const Layout: LucideIcon;
  export const Eye: LucideIcon;
  export const Palette: LucideIcon;
  export const Cloud: LucideIcon;
  export const CloudOff: LucideIcon;
  export const Copy: LucideIcon;
  export const Edit3: LucideIcon;
  export const Wand2: LucideIcon;
  export const FileStack: LucideIcon;
  export const Share: LucideIcon;
  export const Rocket: LucideIcon;
  export const PartyPopper: LucideIcon;
  export const CircleCheck: LucideIcon;
  export const ChevronLeft: LucideIcon;
}
