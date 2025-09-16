import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export type RehearsalReminderEmailProps = {
  userName: string;
  rehearsalTitle: string;
  rehearsalDate: Date;
  rehearsalLocation: string;
  registrationDeadline: Date;
  registrationLink: string;
};

export const RehearsalReminderEmail = ({
  userName,
  rehearsalTitle,
  rehearsalDate,
  rehearsalLocation,
  registrationDeadline,
  registrationLink,
}: RehearsalReminderEmailProps) => {
  const formattedDate = format(rehearsalDate, 'EEEE, d. MMMM yyyy', { locale: de });
  const formattedTime = format(rehearsalDate, 'HH:mm', { locale: de });
  const formattedDeadline = format(registrationDeadline, 'd. MMMM yyyy', { locale: de });

  return (
    <Html>
      <Head />
      <Preview>Erinnerung: Probenteilnahme für {rehearsalTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Erinnerung zur Probenanmeldung</Heading>
          
          <Section style={section}>
            <Text style={text}>Hallo {userName},</Text>
            <Text style={text}>
              wir haben bemerkt, dass du dich noch nicht für die folgende Probe an- oder abgemeldet hast:
            </Text>
            
            <Section style={boxStyle}>
              <Text style={text}>
                <strong>{rehearsalTitle}</strong>
                <br />
                Datum: {formattedDate}
                <br />
                Uhrzeit: {formattedTime} Uhr
                <br />
                Ort: {rehearsalLocation}
              </Text>
            </Section>

            <Text style={text}>
              Die Anmeldefrist endet am {formattedDeadline}. Bitte gib uns bis dahin Bescheid, 
              ob wir mit dir rechnen können.
            </Text>

            <Button style={button} href={registrationLink}>
              Jetzt an-/abmelden
            </Button>

            <Text style={text}>
              Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
              <br />
              <Link href={registrationLink} style={link}>
                {registrationLink}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const section = {
  padding: '0 48px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 20px',
};

const text = {
  color: '#444',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px',
};

const boxStyle = {
  backgroundColor: '#f4f4f4',
  borderRadius: '4px',
  padding: '20px',
  margin: '20px 0',
};

const button = {
  backgroundColor: '#5850ec',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  margin: '20px 0',
};

const link = {
  color: '#5850ec',
  textDecoration: 'underline',
};

export default RehearsalReminderEmail;