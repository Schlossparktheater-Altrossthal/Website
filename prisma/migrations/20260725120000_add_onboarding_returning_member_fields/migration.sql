-- Add onboarding completion tracking to users
ALTER TABLE "User"
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "onboardingUpdatedAt" TIMESTAMP(3);

-- Add structured education fields while keeping legacy onboarding background columns
ALTER TABLE "MemberOnboardingProfile"
ADD COLUMN "educationCategory" TEXT,
ADD COLUMN "educationSchoolName" TEXT,
ADD COLUMN "educationClassName" TEXT,
ADD COLUMN "educationWorkDescription" TEXT,
ADD COLUMN "educationUniversityName" TEXT,
ADD COLUMN "educationOtherDescription" TEXT;
