import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity,TextInput, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PostDto as PostType, CommentDto, ICommentDto, UserDto } from 'services/generated/generatedClient'
import { usePost } from 'hooks/usePosts';
import { ApiClient } from 'services/apiClient';
import Post from './Post';



const CommentTree: React.FC<{
    comment: CommentDto;
    depth: number;
    onAddReply: (text, parentCommentId: string | undefined) => Promise<CommentDto>
    isSubmitting: boolean;
    submitError: string | null;
}> = ({ comment, depth, onAddReply, isSubmitting, submitError }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
  
    const handleReply = async () => {
        if (replyText.trim()) {
            try {
                await onAddReply(replyText.trim(), comment.id);
                setReplyText('');
                setIsReplying(false);
            } catch (error) {
                // Error is handled by parent component via submitError prop
            }
        }
    };
  
    return (
      <View style={[styles.commentContainer, { marginLeft: depth * 8 }]}>

        <View style={styles.commentContent}>
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => setCollapsed(!collapsed)}
          >
            <View style={styles.verticalLine} />
          </TouchableOpacity>
          <View style={styles.commentBody}>
            <Text style={styles.commentAuthor}>{comment.user.name}</Text>
            {!collapsed && (
              <>
                <Text style={styles.commentText}>{comment.text}</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="happy-outline" size={20} color="#1DA1F2" />
                    <Text style={styles.actionButtonText}>React</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => setIsReplying(true)}>
                    <Ionicons name="chatbox-outline" size={20} color="#1DA1F2" />
                    <Text style={styles.actionButtonText}>Reply</Text>
                  </TouchableOpacity>
                </View>
                {isReplying && (
                    <View style={styles.replyContainer}>
                        {submitError && (
                            <Text style={styles.errorText}>{submitError}</Text>
                        )}
                        <TextInput
                            style={styles.replyInput}
                            value={replyText}
                            onChangeText={setReplyText}
                            placeholder="Type your reply..."
                            multiline
                            editable={!isSubmitting}
                        />
                        <View style={styles.replyButtons}>
                            <TouchableOpacity
                                style={styles.replyButton}
                                onPress={() => setIsReplying(false)}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.replyButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.replyButton, isSubmitting && styles.disabledButton]}
                                onPress={handleReply}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.replyButtonText}>
                                    {isSubmitting ? 'Posting...' : 'Comment'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                {comment.replies &&
                    comment.replies.map((reply) => (
                        <CommentTree
                            key={reply.id}
                            comment={reply}
                            depth={depth + 1}
                            onAddReply={onAddReply}
                            isSubmitting={isSubmitting}
                            submitError={submitError}
                        />
                    ))}
            </>
        )}
          </View>
        </View>
      </View>
    );
  };
  
const CommentSection: React.FC<{ 
    route: { params: { postId: string } };
    navigation: any;
  }> = ({ route, navigation }) => {
      const { postId } = route.params;
      const { post, isLoading, error, loadPost } = usePost(postId, true);
      const [comments, setComments] = useState<CommentDto[]>([]);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [submitError, setSubmitError] = useState<string | null>(null);

    // Update comments when post data is loaded
    useEffect(() => {
        if (post?.comments) {
            setComments(post.comments);
        }
    }, [post]);

    useEffect(() => {
        console.log('Posts state (from commentSection):', post);
        console.log('Is Loading (from commentSection):', isLoading);
        console.log('Error (from commentSection):', error);
    }, [post, isLoading, error]);

    const addReply = async (text, parentCommentId: string | undefined ) => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Call the API to create the comment
            const response = await ApiClient.Instance.comment(
                text,
                postId,
                parentCommentId
            );

            // If the API call was successful, update the UI with the returned comment
            const updateReplies = (comments: CommentDto[]): CommentDto[] => {
                return comments.map(comment => {
                    if (comment.id === parentCommentId) {
                        return new CommentDto({
                            ...comment,
                            replies: [...(comment.replies || []), response]
                        });
                    }
                    else if (comment.replies) {
                        return new CommentDto({
                            ...comment,
                            replies: updateReplies(comment.replies)
                        });
                    }
                    return comment;
                });
            };

            setComments(updateReplies(comments));
            setSubmitError(null);
            return response;
        } catch (err) {
            console.error('Failed to post comment:', err);
            setSubmitError('Failed to post comment. Please try again.');
            throw err;
            // You might want to show an error toast or message to the user here
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle loading state
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#0000ff" />
            </SafeAreaView>
        );
    }

    // Handle error state
    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>{error}</Text>
            </SafeAreaView>
        );
    }

    // Handle case where post is undefined
    if (!post) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Post not found</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Comments</Text>
            </View>
            <ScrollView style={styles.container}>
            <Post post={post} isNavigable={false} />
            {comments.map((comment) => (
                    <CommentTree
                        key={comment.id}
                        comment={comment}
                        depth={0}
                        onAddReply={addReply}
                        isSubmitting={isSubmitting}
                        submitError={submitError}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
};
  
  const styles = StyleSheet.create({
    // Header stuff
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e1e4e8',
  },
  backButton: {
      padding: 8,
  },
  headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 16,
  },

  scrollContainer: {
      flex: 1,
      padding: 16,
  },
    container: {
      flex: 1,
      backgroundColor: '#f0f2f5',
    },
    commentContainer: {
        marginTop: 8,
        marginBottom: 8,
      },
      commentContent: {
        flexDirection: 'row',
        borderRadius: 4,
        overflow: 'hidden',
      },
      collapseButton: {
        width: 24,
        backgroundColor: '#f6f8fa',
        alignItems: 'center',
      },
      verticalLine: {
        width: 2,
        backgroundColor: '#1DA1F2',
        flex: 1, // This will make the line fill the height of its container
      },
      commentBody: {
        flex: 1,
        padding: 8,
      },
    commentAuthor: {
      fontWeight: 'bold',
      marginBottom: 4,
    },
    commentText: {
      fontSize: 14,
      marginBottom: 8,
    },
    actionButtons: {
      flexDirection: 'row',
      marginTop: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    actionButtonText: {
      marginLeft: 4,
      color: '#1DA1F2',
      },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 20,
      },
    disabledButton: {
        opacity: 0.5,
    },
    replyContainer: {
      marginTop: 8,
    },
    replyInput: {
      borderWidth: 1,
      borderColor: '#e1e4e8',
      borderRadius: 4,
      padding: 8,
      minHeight: 80,
    },
    replyButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
    },
    replyButton: {
      marginLeft: 8,
      padding: 8,
      backgroundColor: '#1DA1F2',
      borderRadius: 4,
    },
    replyButtonText: {
      color: 'white',
    },
  });
  
  export default CommentSection;