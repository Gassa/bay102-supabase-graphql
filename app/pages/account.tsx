import React from "react";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { Auth, Loading } from "@supabase/ui";
import { useSupabaseClient } from "../lib/supabase";
import { DocumentType, gql } from "../gql";
import { CombinedError, useMutation, useQuery } from "urql";

const UserProfileQuery = gql(/* GraphQL */ `
  query UserProfileQuery($profileId: UUID!) {
    profileCollection(filter: { id: { eq: $profileId } }) {
      edges {
        node {
          ...AccountProfileFragment
        }
      }
    }
  }
`);

const Account: NextPage = () => {
  const session = Auth.useUser();
  const [profileQuery] = useQuery({
    query: UserProfileQuery,
    variables: { profileId: session.user?.id },
    pause: session.user === null,
  });
  const router = useRouter();

  const profile = profileQuery.data?.profileCollection?.edges?.[0].node;

  React.useEffect(() => {
    if (session.user === null || (profileQuery.data && profile === null)) {
      router.replace("/login");
    }
  }, [session.user, profile, profileQuery.data]);

  if (profile) {
    return <AccountForm profile={profile} />;
  }

  return null;
};

const ProfileFragment = gql(/* GraphQL */ `
  fragment AccountProfileFragment on Profile {
    id
    username
    website
  }
`);

const UpdateProfileMutation = gql(/* GraphQL */ `
  mutation updateProfile(
    $userId: UUID!
    $newUsername: String!
    $newWebsite: String!
  ) {
    updateProfileCollection(
      filter: { id: { eq: $userId } }
      set: { username: $newUsername, website: $newWebsite }
    ) {
      affectedCount
      records {
        id
        username
        website
      }
    }
  }
`);

function extractExpectedGraphQLErrors(
  error: CombinedError | undefined
): null | string {
  if (error === undefined) {
    return null;
  }

  for (const graphQLError of error.graphQLErrors) {
    if (graphQLError.message.includes("usernamelength")) {
      return "Username must have a minimum length of 3 characters.";
    }
    if (graphQLError.message.includes("Profile_username_key")) {
      return "The name is already taken.";
    }
  }

  return null;
}

function AccountForm(props: { profile: DocumentType<typeof ProfileFragment> }) {
  const supabaseClient = useSupabaseClient();
  const [username, setUsername] = React.useState(props.profile.username ?? "");
  const [website, setWebsite] = React.useState(props.profile.website ?? "");
  const [updateProfileMutation, updateProfile] = useMutation(
    UpdateProfileMutation
  );

  const errorState = extractExpectedGraphQLErrors(updateProfileMutation.error);

  return (
    <>
      <div className="form-widget">
        <div>
          <label htmlFor="username">Name</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="website"
            value={website || ""}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div>
          <button
            className="button block primary"
            onClick={() =>
              updateProfile({
                userId: props.profile.id,
                newUsername: username,
                newWebsite: website,
              })
            }
            disabled={updateProfileMutation.fetching}
          >
            {updateProfileMutation.fetching ? "Loading ..." : "Update"}
          </button>
        </div>

        <div>{errorState}</div>

        <div>
          <button
            className="button block"
            onClick={() => supabaseClient.auth.signOut()}
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

export default Account;
